import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  accessKeyCheckDigit,
  accessKeyFromQrUrl,
  parseAccessKey,
} from './access-key.js';
import { aliasKey } from './normalization.service.js';
import { ReceiptParseError } from './parsers/nfce-parser.js';
import { splitSpAddress, SpNfceParser } from './parsers/sp.parser.js';

const KEY = '35261111222333000181650010000123451123456780';
const fixture = (name: string) =>
  readFileSync(join(process.cwd(), 'test/fixtures/nfce', name), 'utf8');

describe('NFC-e access key', () => {
  it('validates the module-11 check digit and splits the fields', () => {
    expect(accessKeyCheckDigit(KEY.slice(0, 43))).toBe(0);
    const parsed = parseAccessKey(
      '3526 1111 2223 3300 0181 6500 1000 0123 4511 2345 6780',
    );
    expect(parsed).toEqual({
      ok: true,
      value: {
        key: KEY,
        uf: 'SP',
        year: 2026,
        month: 11,
        cnpj: '11222333000181',
        model: '65',
        series: '001',
        number: '000012345',
      },
    });
  });

  it('rejects wrong length, check digit, state and model', () => {
    expect(parseAccessKey(KEY.slice(0, 43))).toEqual({
      ok: false,
      error: 'LENGTH',
    });
    expect(parseAccessKey(`${KEY.slice(0, 43)}1`)).toEqual({
      ok: false,
      error: 'CHECK_DIGIT',
    });
    const badUf = `99${KEY.slice(2, 43)}`;
    expect(parseAccessKey(badUf + accessKeyCheckDigit(badUf))).toEqual({
      ok: false,
      error: 'UF',
    });
    const nfse = `${KEY.slice(0, 20)}57${KEY.slice(22, 43)}`;
    expect(parseAccessKey(nfse + accessKeyCheckDigit(nfse))).toEqual({
      ok: false,
      error: 'MODEL',
    });
  });

  it('reads the key from the QR code URL', () => {
    const url = new URL(
      `https://www.nfce.fazenda.sp.gov.br/NFCeConsultaPublica/Paginas/ConsultaQRCode.aspx?p=${KEY}|2|1|1|ABC`,
    );
    expect(accessKeyFromQrUrl(url)).toBe(KEY);
    expect(
      accessKeyFromQrUrl(new URL('https://example.com/?p=123')),
    ).toBeNull();
  });
});

describe('SEFAZ-SP parser', () => {
  const parser = new SpNfceParser();

  it('reads issuer, items, total and emission date from the result page', () => {
    const receipt = parser.parse(fixture('sp-consulta-qrcode.html'), KEY);
    expect(receipt.issuer).toEqual({
      name: 'BOM PRECO SUPERMERCADOS LTDA',
      cnpj: '11222333000181',
      address: {
        street: 'RUA DOMINGOS DE MORAIS',
        number: '2000',
        district: 'VILA MARIANA',
        city: 'SAO PAULO',
        state: 'SP',
      },
      addressText:
        'RUA DOMINGOS DE MORAIS, 2000, , VILA MARIANA, SAO PAULO, SP',
    });
    expect(receipt.lines).toEqual([
      {
        description: 'LT LEITE ITAMBE INT 1L',
        code: '7896051111153',
        quantity: 2,
        unit: 'UN',
        unitPrice: 5.49,
        totalPrice: 10.98,
      },
      {
        description: 'ARROZ TP1 CAMIL 5KG',
        code: '2207',
        quantity: 1,
        unit: 'UN',
        unitPrice: 26.9,
        totalPrice: 26.9,
      },
      {
        description: 'BANANA PRATA KG',
        code: '101',
        quantity: 1.235,
        unit: 'KG',
        unitPrice: 6.99,
        totalPrice: 8.63,
      },
    ]);
    expect(receipt.total).toBe(46.51);
    expect(receipt.issuedAt.toISOString()).toBe('2026-11-03T21:42:10.000Z');
  });

  it('refuses pages that are not an NFC-e result', () => {
    expect(() =>
      parser.parse('<html><body>Erro na consulta</body></html>', KEY),
    ).toThrow(ReceiptParseError);
  });

  it('splits addresses without number or district', () => {
    expect(
      splitSpAddress('AV PAULISTA, SN, BELA VISTA, SAO PAULO, SP'),
    ).toEqual({
      street: 'AV PAULISTA',
      number: undefined,
      district: 'BELA VISTA',
      city: 'SAO PAULO',
      state: 'SP',
    });
  });
});

describe('alias key', () => {
  it('normalizes spacing and case', () => {
    expect(aliasKey('  lt  leite   itambé int 1l ')).toBe(
      'LT LEITE ITAMBÉ INT 1L',
    );
  });
});
