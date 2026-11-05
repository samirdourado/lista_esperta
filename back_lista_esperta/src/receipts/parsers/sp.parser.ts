import { load } from 'cheerio';
import type { ParsedReceipt, ReceiptLine } from '../receipt.types.js';
import { brNumber, type NfceParser, ReceiptParseError } from './nfce-parser.js';

const squash = (text: string) => text.replace(/\s+/g, ' ').trim();

/** "RUA X, 100, , VILA MARIANA, SAO PAULO, SP" → address parts. */
export function splitSpAddress(text: string) {
  const parts = text
    .split(',')
    .map((part) => squash(part))
    .filter(Boolean);
  const state =
    parts.length > 0 && /^[A-Z]{2}$/.test(parts[parts.length - 1])
      ? parts.pop()
      : undefined;
  const city = parts.pop();
  const [street, number, ...rest] = parts;
  return {
    street,
    number: number && /\d/.test(number) ? number : undefined,
    district: rest.filter((part) => !/\d{5}-?\d{3}/.test(part)).pop(),
    city,
    state,
  };
}

/**
 * São Paulo: https://www.nfce.fazenda.sp.gov.br/NFCeConsultaPublica/ — the
 * page the QR code opens. Selectors from its public markup (#tabResult items,
 * #u20 issuer, #totalNota totals, #infos emission date).
 */
export class SpNfceParser implements NfceParser {
  readonly uf = 'SP';
  readonly hosts = [
    'www.nfce.fazenda.sp.gov.br',
    'nfce.fazenda.sp.gov.br',
  ] as const;

  parse(html: string, accessKey: string): ParsedReceipt {
    const $ = load(html);
    const name = squash($('#u20').first().text());
    if (!name)
      throw new ReceiptParseError('Issuer not found: not an NFC-e result page');

    const texts = $('#conteudo .txtCenter .text')
      .map((_, el) => squash($(el).text()))
      .get();
    const cnpj = (texts.find((text) => /CNPJ/i.test(text)) ?? '').replace(
      /\D/g,
      '',
    );
    const addressText =
      texts.find((text) => !/CNPJ|IE:|Inscri/i.test(text)) ?? '';

    const lines: ReceiptLine[] = $('#tabResult tr')
      .toArray()
      .flatMap((row) => {
        const cell = $(row);
        const description = squash(cell.find('.txtTit').first().text());
        if (!description) return [];
        const code =
          squash(cell.find('.RCod').text()).replace(/\D/g, '') || null;
        const unit =
          squash(cell.find('.RUN').text().replace(/UN:/i, '')).toUpperCase() ||
          'UN';
        const quantity = brNumber(
          cell
            .find('.Rqtd')
            .text()
            .replace(/Qtde\.?:/i, ''),
        );
        const unitPrice = brNumber(
          cell
            .find('.RvlUnit')
            .text()
            .replace(/Vl\.\s*Unit\.?:/i, ''),
        );
        const totalPrice = brNumber(cell.find('.valor').text());
        return [
          {
            description,
            code,
            quantity,
            unit,
            unitPrice,
            totalPrice,
          },
        ];
      });
    if (lines.length === 0) throw new ReceiptParseError('No items found');

    const totalText = $('#totalNota #linhaTotal')
      .toArray()
      .map((el) => $(el))
      .find((el) => /valor a pagar/i.test(el.text()))
      ?.find('.totalNumb')
      .text();
    const total = totalText
      ? brNumber(totalText)
      : lines.reduce((sum, line) => sum + line.totalPrice, 0);

    const infos = squash($('#infos').text());
    const emission = infos.match(
      /Emiss[ãa]o:\s*(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}:\d{2}:\d{2})(-0\d:00)?/i,
    );
    if (!emission) throw new ReceiptParseError('Emission date not found');
    const [, day, month, year, time, offset] = emission;
    const issuedAt = new Date(
      `${year}-${month}-${day}T${time}${offset ?? '-03:00'}`,
    );

    return {
      accessKey,
      issuer: { name, cnpj, address: splitSpAddress(addressText), addressText },
      issuedAt,
      total: Math.round(total * 100) / 100,
      lines,
      source: 'SEFAZ',
    };
  }
}
