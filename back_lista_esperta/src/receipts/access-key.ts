/** IBGE state codes used in the first two digits of the access key. */
export const UF_BY_CODE: Record<string, string> = {
  '11': 'RO',
  '12': 'AC',
  '13': 'AM',
  '14': 'RR',
  '15': 'PA',
  '16': 'AP',
  '17': 'TO',
  '21': 'MA',
  '22': 'PI',
  '23': 'CE',
  '24': 'RN',
  '25': 'PB',
  '26': 'PE',
  '27': 'AL',
  '28': 'SE',
  '29': 'BA',
  '31': 'MG',
  '32': 'ES',
  '33': 'RJ',
  '35': 'SP',
  '41': 'PR',
  '42': 'SC',
  '43': 'RS',
  '50': 'MS',
  '51': 'MT',
  '52': 'GO',
  '53': 'DF',
};

export interface AccessKey {
  key: string;
  uf: string;
  year: number;
  month: number;
  cnpj: string;
  /** 65 = NFC-e (consumer receipt), 55 = NF-e. */
  model: string;
  series: string;
  number: string;
}

/** Module 11 with weights 2..9 from the right (Manual de Orientação do Contribuinte). */
export function accessKeyCheckDigit(first43: string): number {
  let weight = 2;
  let sum = 0;
  for (let i = first43.length - 1; i >= 0; i -= 1) {
    sum += Number(first43[i]) * weight;
    weight = weight === 9 ? 2 : weight + 1;
  }
  const rest = sum % 11;
  return rest < 2 ? 0 : 11 - rest;
}

export type AccessKeyError = 'LENGTH' | 'CHECK_DIGIT' | 'UF' | 'MODEL';

/** Validates and splits a 44-digit access key. Spaces and dots are ignored. */
export function parseAccessKey(
  raw: string,
): { ok: true; value: AccessKey } | { ok: false; error: AccessKeyError } {
  const key = raw.replace(/\D/g, '');
  if (key.length !== 44) return { ok: false, error: 'LENGTH' };
  if (accessKeyCheckDigit(key.slice(0, 43)) !== Number(key[43]))
    return { ok: false, error: 'CHECK_DIGIT' };
  const uf = UF_BY_CODE[key.slice(0, 2)];
  if (!uf) return { ok: false, error: 'UF' };
  const model = key.slice(20, 22);
  if (model !== '65' && model !== '55') return { ok: false, error: 'MODEL' };
  return {
    ok: true,
    value: {
      key,
      uf,
      year: 2000 + Number(key.slice(2, 4)),
      month: Number(key.slice(4, 6)),
      cnpj: key.slice(6, 20),
      model,
      series: key.slice(22, 25),
      number: key.slice(25, 34),
    },
  };
}

/** The NFC-e QR code is a URL whose `p` parameter starts with the access key. */
export function accessKeyFromQrUrl(url: URL): string | null {
  const p = url.searchParams.get('p') ?? url.searchParams.get('chNFe');
  const key = p?.split('|')[0]?.replace(/\D/g, '');
  return key && key.length === 44 ? key : null;
}
