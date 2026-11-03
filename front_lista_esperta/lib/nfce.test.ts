import { expect, test } from "vitest";
import { dvModulo11, parseChave } from "@/lib/nfce";

// Chave sintética: SP (35), nov/2026, CNPJ fictício, modelo 65.
const base = "35" + "2611" + "12345678000195" + "65" + "001" + "000012345" + "1" + "12345678";
const chave = base + dvModulo11(base);

test("aceita chave válida pura ou dentro da URL do QR Code", () => {
  for (const input of [chave, `https://www.nfce.fazenda.sp.gov.br/qrcode?p=${chave}|2|1|1|abc`]) {
    const r = parseChave(input);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.uf).toBe("SP");
      expect(r.value.cnpj).toBe("12345678000195");
      expect(r.value.issuedMonth).toBe(11);
    }
  }
});

test("rejeita dígito verificador errado", () => {
  const wrong = base + ((dvModulo11(base) + 1) % 10);
  expect(parseChave(wrong).ok).toBe(false);
});

test("rejeita NF-e modelo 55", () => {
  const b = base.slice(0, 20) + "55" + base.slice(22);
  expect(parseChave(b + dvModulo11(b)).ok).toBe(false);
});
