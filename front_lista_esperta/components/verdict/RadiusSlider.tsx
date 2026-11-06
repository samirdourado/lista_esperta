"use client";

import { type CSSProperties, useEffect, useId, useState } from "react";

export const MIN_RADIUS_KM = 0.5;
export const MAX_RADIUS_KM = 10;
const STEP = 0.5;
const COMMIT_MS = 400;

const kmText = (value: number) => `${value.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} km`;

/**
 * How far to look, from 0.5 to 10 km. The number moves with the thumb; the
 * search only runs once the person stops dragging.
 */
export function RadiusSlider({ value, onCommit }: { value: number; onCommit: (value: number) => void }) {
  const id = useId();
  const [draft, setDraft] = useState(value);
  const [synced, setSynced] = useState(value);
  // A new value from outside (account, device) replaces the draft.
  if (value !== synced) {
    setSynced(value);
    setDraft(value);
  }

  useEffect(() => {
    if (draft === value) return;
    const timer = setTimeout(() => onCommit(draft), COMMIT_MS);
    return () => clearTimeout(timer);
  }, [draft, value, onCommit]);

  const percent = ((draft - MIN_RADIUS_KM) / (MAX_RADIUS_KM - MIN_RADIUS_KM)) * 100;

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="font-medium">
          Lojas até
        </label>
        <output htmlFor={id} className="text-2xl font-bold tabular-nums">
          {kmText(draft)}
        </output>
      </div>
      <input
        id={id}
        type="range"
        min={MIN_RADIUS_KM}
        max={MAX_RADIUS_KM}
        step={STEP}
        value={draft}
        onChange={(event) => setDraft(Number(event.target.value))}
        aria-valuetext={`até ${kmText(draft)} de você`}
        className="radius-slider mt-2 w-full"
        style={{ "--fill": `${percent}%` } as CSSProperties}
      />
      <div aria-hidden="true" className="mt-1 flex justify-between text-[0.85rem] text-muted tabular-nums">
        <span>{kmText(MIN_RADIUS_KM)}</span>
        <span>{kmText(MAX_RADIUS_KM)}</span>
      </div>
    </div>
  );
}
