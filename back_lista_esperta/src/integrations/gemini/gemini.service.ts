import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import type { Env } from '../../config/env.schema.js';
import { ExternalServiceError } from '../http.js';
import {
  ExtractedFlyerDto,
  ExtractedListDto,
  ExtractedReceiptDto,
  FLYER_SCHEMA,
  LIST_SCHEMA,
  NORMALIZE_SCHEMA,
  NormalizedBatchDto,
  type NormalizedProductDto,
  RECEIPT_SCHEMA,
} from './gemini.dto.js';

/** Turns raw receipt descriptions into catalog products (spec section 8). */
export interface ProductNormalizer {
  readonly enabled: boolean;
  normalize(
    descriptions: string[],
    categorySlugs: string[],
  ): Promise<NormalizedProductDto[]>;
}
export const PRODUCT_NORMALIZER = Symbol('PRODUCT_NORMALIZER');

/** Reads a receipt photo when the QR code is not readable. */
export interface ReceiptReader {
  readonly enabled: boolean;
  read(image: Buffer, mimeType: string): Promise<ExtractedReceiptDto>;
}
export const RECEIPT_READER = Symbol('RECEIPT_READER');

/** Reads a photo of a shopping list (spec section 6, item 1). */
export interface ListReader {
  readonly enabled: boolean;
  readList(image: Buffer, mimeType: string): Promise<ExtractedListDto>;
}
export const LIST_READER = Symbol('LIST_READER');

/** Reads the products and prices of a store flyer (text from Firecrawl). */
export interface FlyerReader {
  readonly enabled: boolean;
  readFlyer(text: string, today: string): Promise<ExtractedFlyerDto>;
}
export const FLYER_READER = Symbol('FLYER_READER');

/** Flyers can be long; the model only needs the product part. */
const FLYER_MAX_CHARS = 40_000;

export class AiOutputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AiOutputError';
  }
}

const RETRYABLE = new Set([429, 500, 503]);
const RETRY_DELAY_MS = 1500;

type Part =
  { text: string } | { inline_data: { mime_type: string; data: string } };

/** Validates model output with class-validator before anything is stored. */
async function validated<T extends object>(
  cls: new () => T,
  json: unknown,
): Promise<T> {
  const instance = plainToInstance(cls, json);
  const errors = await validate(instance, { whitelist: true });
  if (errors.length > 0) {
    throw new AiOutputError(
      `Model output failed validation: ${errors.map((e) => e.property).join(', ')}`,
    );
  }
  return instance;
}

const NORMALIZE_PROMPT = (
  lines: string[],
  slugs: string[],
) => `Você normaliza descrições de itens de cupom fiscal brasileiro (NFC-e).
Para cada linha, devolva o produto canônico em português, com marca, categoria, unidade de venda e quantidade da embalagem.
- canonical_name: tipo do produto + variação + marca + tamanho, sem abreviações. Ex.: "LT LEITE ITAMBE INT 1L" → "Leite UHT Integral Itambé 1 L"; "DET YPE NEUTRO 500ML" → "Detergente Líquido Neutro Ypê 500 ml". Sem marca na descrição, não invente marca.
Regras:
- category_slug deve ser um destes: ${slugs.join(', ')}.
- unit: "un" (unidades), "g", "kg", "ml", "l", "m" ou "m2". unit_quantity é o tamanho da embalagem (ex.: leite 1 L → unit "l", unit_quantity 1; ovos dúzia → "un", 12).
- Itens vendidos a granel por peso (ex.: "BANANA PRATA KG") → unit "kg", unit_quantity 1.
- gtin só se estiver escrito na descrição; senão null. Nunca invente.
- confidence de 0 a 1: quão certo você está de que entendeu o produto. Abreviações ambíguas → abaixo de 0.8.
- Devolva um item por linha, com o mesmo index.
Linhas:
${lines.map((line, index) => `${index}: ${line}`).join('\n')}`;

const LIST_PROMPT = `Esta é a foto de uma lista de compras (escrita à mão ou impressa), em português.
Devolva um item por linha da lista, com o texto como a pessoa escreveu (corrigindo só a grafia óbvia) e a quantidade.
- quantity: o número de unidades pedido ("2 leite" → 2). Sem número, 1. Peso e volume ficam no texto ("arroz 5kg").
- Ignore riscos, rabiscos e o que não for item de compra. Não invente itens.`;

const RECEIPT_PROMPT = `Leia este cupom fiscal brasileiro (NFC-e) e devolva os dados exatamente como impressos.
- access_key: os 44 dígitos da chave de acesso, sem espaços; null se não estiver legível.
- cnpj: só dígitos. issued_at: data e hora de emissão em ISO 8601 com -03:00.
- lines: um item por linha do cupom, com quantidade, unidade (UN, KG, L…), valor unitário e total.
- Valores em reais como número (12,90 → 12.9). Não invente itens que não estão na imagem.`;

const FLYER_PROMPT = (
  text: string,
  today: string,
) => `Este é o texto de um encarte (folheto de ofertas) de uma loja brasileira. Hoje é ${today}.
Devolva cada produto com preço que o encarte anuncia.
- description: o produto como está escrito, com marca e tamanho (ex.: "Leite UHT Integral Itambé 1 L").
- price: o preço por unidade anunciada, em reais (12,90 → 12.9). Em "leve 3 pague 2" ou preço de atacado, use o preço de uma unidade avulsa se ele estiver escrito; senão, pule o item.
- gtin só se o código de barras estiver escrito; senão null.
- valid_until: o último dia das ofertas (AAAA-MM-DD), se o encarte disser; senão null.
- Ignore textos que não sejam produtos com preço. Não invente produtos nem preços.
Texto do encarte:
${text.slice(0, FLYER_MAX_CHARS)}`;

@Injectable()
export class GeminiService
  implements ProductNormalizer, ReceiptReader, ListReader, FlyerReader
{
  private readonly logger = new Logger(GeminiService.name);

  constructor(private readonly config: ConfigService<Env, true>) {}

  get enabled(): boolean {
    return Boolean(this.config.get('GEMINI_API_KEY', { infer: true }));
  }

  async normalize(
    descriptions: string[],
    categorySlugs: string[],
  ): Promise<NormalizedProductDto[]> {
    if (!this.enabled || descriptions.length === 0) return [];
    const json = await this.generate(
      [{ text: NORMALIZE_PROMPT(descriptions, categorySlugs) }],
      NORMALIZE_SCHEMA,
    );
    const batch = await validated(NormalizedBatchDto, json);
    return batch.items.filter(
      (item) =>
        item.index < descriptions.length &&
        categorySlugs.includes(item.category_slug),
    );
  }

  async read(image: Buffer, mimeType: string): Promise<ExtractedReceiptDto> {
    const json = await this.generate(
      [
        { text: RECEIPT_PROMPT },
        {
          inline_data: { mime_type: mimeType, data: image.toString('base64') },
        },
      ],
      RECEIPT_SCHEMA,
    );
    return validated(ExtractedReceiptDto, json);
  }

  async readList(image: Buffer, mimeType: string): Promise<ExtractedListDto> {
    const json = await this.generate(
      [
        { text: LIST_PROMPT },
        {
          inline_data: { mime_type: mimeType, data: image.toString('base64') },
        },
      ],
      LIST_SCHEMA,
    );
    return validated(ExtractedListDto, json);
  }

  async readFlyer(text: string, today: string): Promise<ExtractedFlyerDto> {
    const json = await this.generate(
      [{ text: FLYER_PROMPT(text, today) }],
      FLYER_SCHEMA,
    );
    return validated(ExtractedFlyerDto, json);
  }

  private async generate(parts: Part[], schema: object): Promise<unknown> {
    const key = this.config.get('GEMINI_API_KEY', { infer: true });
    if (!key)
      throw new ExternalServiceError(
        'gemini',
        null,
        'GEMINI_API_KEY is not set',
      );
    const base = this.config.get('GEMINI_URL', { infer: true });
    const models = [
      this.config.get('GEMINI_MODEL', { infer: true }),
      ...this.config.get('GEMINI_FALLBACK_MODELS', { infer: true }),
    ];
    const body = JSON.stringify({
      contents: [{ role: 'user', parts }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: schema,
        temperature: 0,
      },
    });
    let response: Response | undefined;
    // Free tier models get busy (429/503) or retired (404): retry, then try the next model.
    models: for (const model of models) {
      for (let attempt = 0; attempt < 2; attempt += 1) {
        if (attempt > 0)
          await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
        try {
          response = await fetch(`${base}/models/${model}:generateContent`, {
            method: 'POST',
            // The key goes in a header, never in the URL (it would end up in logs).
            headers: {
              'Content-Type': 'application/json',
              'x-goog-api-key': key,
            },
            body,
            signal: AbortSignal.timeout(60_000),
          });
        } catch {
          response = undefined;
          continue;
        }
        if (response.ok) break models;
        if (response.status === 404) continue models;
        if (!RETRYABLE.has(response.status)) break models;
        this.logger.warn(
          `Gemini ${model} answered HTTP ${response.status} (attempt ${attempt + 1})`,
        );
      }
    }
    if (!response) throw new ExternalServiceError('gemini', null, 'no answer');
    if (!response.ok) {
      this.logger.warn(`Gemini answered HTTP ${response.status}`);
      throw new ExternalServiceError(
        'gemini',
        response.status,
        `HTTP ${response.status}`,
      );
    }
    const answer = (await response.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const text = answer.candidates?.[0]?.content?.parts
      ?.map((part) => part.text ?? '')
      .join('');
    if (!text) throw new AiOutputError('Empty model answer');
    try {
      return JSON.parse(text) as unknown;
    } catch {
      throw new AiOutputError('Model answer is not JSON');
    }
  }
}
