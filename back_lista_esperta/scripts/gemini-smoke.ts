// Manual check of the real Gemini normalizer (not part of the test suite).
import 'dotenv/config';
import { GeminiService } from '../src/integrations/gemini/gemini.service.js';

const env: Record<string, string | undefined> = {
  GEMINI_API_KEY: process.env.GEMINI_API_KEY,
  GEMINI_MODEL: process.env.GEMINI_MODEL ?? 'gemini-2.5-flash',
  GEMINI_FALLBACK_MODELS: ['gemini-flash-lite-latest'] as never,
  GEMINI_URL: 'https://generativelanguage.googleapis.com/v1beta',
};
const service = new GeminiService({ get: (key: string) => env[key] } as never);
const lines = ['LT LEITE ITAMBE INT 1L', 'ARROZ TP1 CAMIL 5KG', 'BANANA PRATA KG', 'DET YPE NEUTRO 500ML', 'CR DENT COLG TRIP 90G', 'XPTO 2X LV 3'];
const slugs = ['alimentos', 'mercearia', 'laticinios', 'hortifruti', 'acougue', 'padaria', 'bebidas', 'limpeza', 'higiene', 'farmacia'];
const started = Date.now();
service
  .normalize(lines, slugs)
  .then((items) => {
    console.log(`${items.length}/${lines.length} itens em ${Date.now() - started} ms`);
    for (const item of items) {
      console.log(`${lines[item.index].padEnd(24)} → ${item.canonical_name} | ${item.category_slug} | ${item.unit_quantity} ${item.unit} | conf ${item.confidence}`);
    }
  })
  .catch((error: unknown) => console.error('falhou:', error instanceof Error ? error.message : error));
