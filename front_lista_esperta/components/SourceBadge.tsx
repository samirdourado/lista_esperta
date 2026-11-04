import type { Badge, BadgeTone } from "@/lib/verdict/confidence";

const TONE: Record<BadgeTone, { className: string; mark: string }> = {
  confirmed: { className: "bg-save-soft text-save", mark: "●" },
  advertised: { className: "bg-amber-soft text-amber", mark: "◆" },
  community: { className: "bg-orange-soft text-orange", mark: "▲" },
  estimated: { className: "bg-muted-soft text-muted italic", mark: "○" },
};

/** Selo de procedência: forma + cor + texto, para não depender só de cor. */
export function SourceBadge({ badge }: { badge: Badge }) {
  const tone = TONE[badge.tone];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[0.8rem] leading-tight ${tone.className}`}
    >
      <span aria-hidden="true" className="text-[0.6rem]">
        {tone.mark}
      </span>
      {badge.text}
    </span>
  );
}
