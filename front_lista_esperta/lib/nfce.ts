// Validação local da chave de acesso da NFC-e (Seção 1.2-B): roda antes de qualquer
// consulta à Sefaz e descarta QR adulterado ou de outro tipo de documento.

const UF_BY_CODE: Record<string, string> = {
  "11": "RO",
  "12": "AC",
  "13": "AM",
  "14": "RR",
  "15": "PA",
  "16": "AP",
  "17": "TO",
  "21": "MA",
  "22": "PI",
  "23": "CE",
  "24": "RN",
  "25": "PB",
  "26": "PE",
  "27": "AL",
  "28": "SE",
  "29": "BA",
  "31": "MG",
  "32": "ES",
  "33": "RJ",
  "35": "SP",
  "41": "PR",
  "42": "SC",
  "43": "RS",
  "50": "MS",
  "51": "MT",
  "52": "GO",
  "53": "DF",
};

export interface ChaveNFCe {
  chave: string;
  uf: string;
  issuedYear: number;
  issuedMonth: number;
  cnpj: string;
  series: string;
  number: string;
  contingency: boolean;
}

export type ChaveResult = { ok: true; value: ChaveNFCe } | { ok: false; error: string };

export function dvModulo11(base43: string): number {
  let weight = 2;
  let sum = 0;
  for (let i = base43.length - 1; i >= 0; i--) {
    sum += Number(base43[i]) * weight;
    weight = weight === 9 ? 2 : weight + 1;
  }
  const rest = sum % 11;
  return rest < 2 ? 0 : 11 - rest;
}

/** Aceita a URL do QR Code (parâmetro p=chave|...) ou a chave de 44 dígitos colada. */
export function parseChave(input: string): ChaveResult {
  const text = input.trim();
  let candidate = text.replace(/\s/g, "");
  try {
    const p = new URL(text).searchParams.get("p");
    if (p) candidate = p.split("|")[0];
  } catch {
    // não é URL: segue com o texto
  }
  candidate = candidate.replace(/\D/g, "");

  if (candidate.length !== 44)
    return { ok: false, error: "A chave de acesso tem 44 dígitos. Confira se o QR Code ou a chave estão completos." };
  if (candidate.slice(20, 22) !== "65")
    return { ok: false, error: "Esta chave não é de uma NFC-e (cupom fiscal de consumidor)." };
  if (dvModulo11(candidate.slice(0, 43)) !== Number(candidate[43])) {
    return { ok: false, error: "O dígito verificador não confere. A chave pode ter sido lida ou digitada errada." };
  }
  const uf = UF_BY_CODE[candidate.slice(0, 2)];
  if (!uf) return { ok: false, error: "O código de estado da chave não existe." };

  return {
    ok: true,
    value: {
      chave: candidate,
      uf,
      issuedYear: 2000 + Number(candidate.slice(2, 4)),
      issuedMonth: Number(candidate.slice(4, 6)),
      cnpj: candidate.slice(6, 20),
      series: candidate.slice(22, 25),
      number: candidate.slice(25, 34),
      contingency: candidate[34] === "9",
    },
  };
}

export const formatCnpj = (c: string) => c.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
