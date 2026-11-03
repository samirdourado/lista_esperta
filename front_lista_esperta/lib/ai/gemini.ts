// Leitura de foto de lista com o Gemini (Prompt 1 da Seção 1.5). Usa a API REST para não
// depender de SDK; o modelo vem de GEMINI_MODEL_FAST.

const SYSTEM_PROMPT = `Você converte listas de compras brasileiras (manuscritas, digitadas, fotos de papel, prints de WhatsApp) em itens estruturados. Regras:
- Um item por linha da lista. Não invente itens.
- Expanda abreviações comuns: "lt" = leite, "cx" = caixa, "pct" = pacote, "dz" = dúzia, "refri" = refrigerante.
- quantidade: número de unidades que a pessoa quer (padrão 1). "2kg de carne" → quantidade 2, unidade "kg".
- marca: preencha SOMENTE se a pessoa escreveu uma marca; senão null.
- Se a caligrafia for ilegível, devolva o trecho em "texto_original" e confianca < 0.5. Nunca adivinhe silenciosamente.`;

const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    itens: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          texto_original: { type: "STRING" },
          nome_generico: { type: "STRING" },
          marca: { type: "STRING", nullable: true },
          quantidade: { type: "NUMBER" },
          unidade: { type: "STRING", enum: ["un", "kg", "g", "l", "ml", "pacote", "caixa", "duzia"] },
          tamanho_embalagem: { type: "STRING", nullable: true },
          confianca: { type: "NUMBER" },
        },
        required: ["texto_original", "nome_generico", "quantidade", "unidade", "confianca"],
      },
    },
  },
  required: ["itens"],
};

interface GeminiItem {
  texto_original: string;
  nome_generico: string;
  marca?: string | null;
  quantidade: number;
  unidade: string;
  tamanho_embalagem?: string | null;
  confianca: number;
}

export class GeminiUnavailableError extends Error {}

/** Converte o item estruturado em uma linha que o parser local entende. */
function toLine(i: GeminiItem): string {
  if (i.confianca < 0.5) return i.texto_original;
  const weighed = i.unidade === "kg" || i.unidade === "g";
  const qty = weighed ? `${i.quantidade}${i.unidade} ` : i.quantidade > 1 ? `${i.quantidade} ` : "";
  return [qty + i.nome_generico, i.marca, i.tamanho_embalagem].filter(Boolean).join(" ");
}

export async function readListPhoto(image: Blob): Promise<string[]> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new GeminiUnavailableError("A leitura de foto precisa da chave GEMINI_API_KEY no servidor. Digite ou cole a lista por enquanto.");
  const model = process.env.GEMINI_MODEL_FAST || "gemini-flash-latest";
  const data = Buffer.from(await image.arrayBuffer()).toString("base64");

  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [
        {
          role: "user",
          parts: [{ inline_data: { mime_type: image.type || "image/jpeg", data } }, { text: "Extraia os itens desta lista." }],
        },
      ],
      generationConfig: { responseMimeType: "application/json", responseSchema: RESPONSE_SCHEMA, temperature: 0 },
    }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`O Gemini respondeu com erro ${res.status}. Tente de novo ou digite a lista.`);

  const body = (await res.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
  const text = body.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
  const parsed = JSON.parse(text) as { itens?: GeminiItem[] };
  return (parsed.itens ?? []).map(toLine).filter((l) => l.trim().length > 1);
}
