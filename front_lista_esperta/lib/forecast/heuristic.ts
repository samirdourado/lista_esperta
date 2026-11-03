import type { Category } from "@/lib/types";
import type { PlanView } from "@/lib/verdict/build";

// Provedor heurístico (Seção 2.4): padrões semanais extraídos dos encartes. A Vigil Labs
// entra pela mesma interface quando as credenciais estiverem disponíveis.

export interface Tip {
  message: string;
  saving: number;
  confidence: number;
  source: string;
  /** Linhas da lista que podem esperar. */
  lines: number[];
  day: string;
}

interface Pattern {
  category: Category;
  weekday: number; // 0 = domingo
  day: string;
  changePct: number;
  confidence: number;
  noun: string;
}

const PATTERNS: Pattern[] = [
  { category: "acougue", weekday: 3, day: "quarta", changePct: 0.12, confidence: 0.72, noun: "Carne" },
  { category: "hortifruti", weekday: 3, day: "quarta", changePct: 0.15, confidence: 0.74, noun: "Hortifrúti" },
];

const MIN_SAVING = 5;
const MIN_CONFIDENCE = 0.7;

export function pickTip(plan: PlanView | null, today: Date): Tip | null {
  if (!plan) return null;
  const items = [...plan.stores.flatMap((s) => s.items), ...plan.estimated];
  const tips = PATTERNS.filter((p) => p.weekday !== today.getDay() && p.confidence >= MIN_CONFIDENCE)
    .map((p) => {
      const affected = items.filter((i) => i.category === p.category);
      const saving = affected.reduce((s, i) => s + i.cost, 0) * p.changePct;
      return {
        message: `${p.noun} costuma baixar às ${p.day}s neste bairro`,
        saving,
        confidence: p.confidence,
        source: "Encartes das últimas 4 semanas",
        lines: affected.map((i) => i.line),
        day: p.day,
      };
    })
    .filter((t) => t.saving >= MIN_SAVING)
    .sort((a, b) => b.saving - a.saving);
  return tips[0] ?? null; // no máximo uma dica
}
