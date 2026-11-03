import { brlSpoken, splitBrl } from "@/lib/format";

/** Etiqueta de gôndola com o custo total. Tamanho controlado pelo font-size do pai. */
export function PriceTag({ value, land = false }: { value: number; land?: boolean }) {
  const { int, cents } = splitBrl(value);
  return (
    <span role="img" aria-label={brlSpoken(value)} className={`price-tag ${land ? "price-tag-land" : ""}`}>
      <span className="currency" aria-hidden="true">
        R$
      </span>
      <span aria-hidden="true">{int}</span>
      <span className="cents" aria-hidden="true">
        {cents}
      </span>
    </span>
  );
}
