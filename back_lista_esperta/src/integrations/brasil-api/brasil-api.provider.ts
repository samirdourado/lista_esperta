import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../config/env.schema.js';
import { ExternalServiceError, fetchJson } from '../http.js';
import type { CnpjLookup, CompanyRecord } from '../providers.js';

export interface BrasilApiCnpj {
  cnpj: string;
  razao_social: string;
  nome_fantasia: string | null;
  descricao_situacao_cadastral: string;
  descricao_tipo_de_logradouro?: string | null;
  logradouro?: string | null;
  numero?: string | null;
  bairro?: string | null;
  municipio?: string | null;
  uf?: string | null;
  cep?: string | null;
}

export function toCompanyRecord(data: BrasilApiCnpj): CompanyRecord {
  const street = [data.descricao_tipo_de_logradouro, data.logradouro]
    .filter(Boolean)
    .join(' ');
  return {
    cnpj: data.cnpj,
    legalName: data.razao_social,
    tradeName: data.nome_fantasia || null,
    registrationStatus: data.descricao_situacao_cadastral,
    address: Object.fromEntries(
      Object.entries({
        street: street || undefined,
        number: data.numero ?? undefined,
        district: data.bairro ?? undefined,
        city: data.municipio ?? undefined,
        state: data.uf ?? undefined,
        postcode: data.cep ?? undefined,
      }).filter(([, value]) => value),
    ),
  };
}

/** https://brasilapi.com.br/docs#tag/CNPJ — free, no key. */
@Injectable()
export class BrasilApiCnpjLookup implements CnpjLookup {
  constructor(private readonly config: ConfigService<Env, true>) {}

  async find(cnpj: string): Promise<CompanyRecord | null> {
    const base = this.config.get('BRASILAPI_URL', { infer: true });
    const { status, body } = await fetchJson<BrasilApiCnpj>(
      'brasilapi',
      `${base}/cnpj/v1/${cnpj}`,
      {
        timeoutMs: 15_000,
        userAgent: this.config.get('HTTP_USER_AGENT', { infer: true }),
      },
    );
    if (status === 404 || status === 400) return null;
    if (!body) {
      throw new ExternalServiceError('brasilapi', status, `HTTP ${status}`);
    }
    return toCompanyRecord(body);
  }
}
