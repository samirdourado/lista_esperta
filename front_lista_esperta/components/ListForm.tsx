"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useId, useMemo, useRef, useState } from "react";
import { PILOT_CENTER, PILOT_COVERAGE_M } from "@/lib/demo/stores";
import { qtyLabel } from "@/lib/format";
import { distanceM } from "@/lib/geo";
import { EXAMPLE_LIST, parseLine, splitLines, type ParsedLine } from "@/lib/list/parse";
import { DEFAULT_RADIUS_M, RADIUS_OPTIONS_M, verdictHref } from "@/lib/list/query";
import type { LatLng, TravelMode } from "@/lib/types";
import { MODE_LABEL } from "@/lib/verdict/params";

type Status = { kind: "idle" } | { kind: "busy"; text: string } | { kind: "error"; text: string };

const MODES = Object.keys(MODE_LABEL) as TravelMode[];

export function ListForm() {
  const router = useRouter();
  const params = useSearchParams();
  const listId = useId();
  const fileRef = useRef<HTMLInputElement>(null);

  const [text, setText] = useState(() => params.getAll("i").join("\n"));
  const [radiusM, setRadiusM] = useState(() => {
    const r = Number(params.get("r"));
    return RADIUS_OPTIONS_M.includes(r) ? r : DEFAULT_RADIUS_M;
  });
  const [mode, setMode] = useState<TravelMode>(() => {
    const m = params.get("m") as TravelMode;
    return MODES.includes(m) ? m : "DRIVE";
  });
  const [unlocked, setUnlocked] = useState<Set<string>>(new Set());
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  const lines = useMemo(() => splitLines(text), [text]);
  const parsed = useMemo(() => lines.map(parseLine), [lines]);
  const recognized = parsed.filter((p) => p.group).length;

  const removeLine = (index: number) => setText(lines.filter((_, i) => i !== index).join("\n"));
  const toggleBrand = (raw: string) =>
    setUnlocked((prev) => {
      const next = new Set(prev);
      if (next.has(raw)) next.delete(raw);
      else next.add(raw);
      return next;
    });

  async function onPhoto(file: File) {
    setStatus({ kind: "busy", text: "Lendo a foto da lista…" });
    try {
      const body = new FormData();
      body.append("image", await downscale(file));
      const res = await fetch("/api/lists/parse", { method: "POST", body });
      const data = (await res.json()) as { lines?: string[]; error?: string };
      if (!res.ok || !data.lines) throw new Error(data.error ?? "Não foi possível ler a foto.");
      if (data.lines.length === 0) throw new Error("Nenhum item encontrado na foto. Tente com mais luz ou digite a lista.");
      setText((prev) => [prev.trim(), ...data.lines!].filter(Boolean).join("\n"));
      setStatus({ kind: "idle" });
    } catch (e) {
      setStatus({ kind: "error", text: e instanceof Error ? e.message : "Não foi possível ler a foto." });
    }
  }

  async function submit() {
    setStatus({ kind: "busy", text: "Pegando sua localização…" });
    const here = await locate();
    const pilot = !here || distanceM(here, PILOT_CENTER) > PILOT_COVERAGE_M;
    setStatus({ kind: "busy", text: `Comparando ${recognized} itens nos mercados por perto…` });
    router.push(
      verdictHref({
        lines: lines.map((raw) => ({ raw, brandUnlocked: unlocked.has(raw) })),
        origin: pilot ? PILOT_CENTER : here!,
        radiusM,
        mode,
        pilot,
        ads: true,
      }),
    );
  }

  const busy = status.kind === "busy";

  return (
    <form
      className="mt-8"
      onSubmit={(e) => {
        e.preventDefault();
        if (recognized > 0 && !busy) void submit();
      }}
    >
      <label htmlFor={listId} className="sr-only">
        Sua lista de compras, um item por linha
      </label>
      <textarea
        id={listId}
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={7}
        placeholder={"arroz 5kg\n2 leite integral\ncafé pilão\n1kg contrafilé"}
        className="ruled block w-full resize-y rounded-lg border border-line px-4 py-3 text-lg placeholder:text-muted focus:border-ink focus:outline-none"
      />

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-full border border-ink px-4 py-2 font-medium hover:bg-surface disabled:opacity-50"
        >
          <CameraIcon />
          Foto da lista
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          tabIndex={-1}
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) void onPhoto(f);
          }}
        />
        {lines.length === 0 && (
          <button type="button" onClick={() => setText(EXAMPLE_LIST)} className="px-2 py-2 font-medium underline underline-offset-4">
            Usar uma lista de exemplo
          </button>
        )}
      </div>

      {parsed.length > 0 && (
        <section aria-label="Itens entendidos" className="mt-6">
          <p className="text-[0.95rem] text-ink-soft">
            Entendemos {recognized} de {parsed.length} {parsed.length === 1 ? "item" : "itens"}. Toque em um item com marca
            para aceitar outra marca mais barata.
          </p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {parsed.map((p, i) => (
              <Chip
                key={`${i}-${p.raw}`}
                item={p}
                unlocked={unlocked.has(p.raw)}
                onToggleBrand={() => toggleBrand(p.raw)}
                onRemove={() => removeLine(i)}
              />
            ))}
          </ul>
        </section>
      )}

      <fieldset className="mt-8">
        <legend className="font-display text-xl font-semibold">Até onde você vai?</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {RADIUS_OPTIONS_M.map((r) => (
            <Segment key={r} name="raio" checked={radiusM === r} onChange={() => setRadiusM(r)}>
              {r / 1000} km
            </Segment>
          ))}
        </div>
      </fieldset>

      <fieldset className="mt-5">
        <legend className="font-display text-xl font-semibold">Como você vai?</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {MODES.map((m) => (
            <Segment key={m} name="modo" checked={mode === m} onChange={() => setMode(m)}>
              {MODE_LABEL[m]}
            </Segment>
          ))}
        </div>
      </fieldset>

      <button
        type="submit"
        disabled={recognized === 0 || busy}
        className="mt-8 w-full rounded-full bg-ink px-6 py-4 font-display text-2xl font-semibold text-paper hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
      >
        Ver onde comprar
      </button>
      <p role="status" aria-live="polite" className={`mt-3 min-h-6 text-[0.95rem] ${status.kind === "error" ? "text-danger" : "text-ink-soft"}`}>
        {status.kind === "idle" ? "Sua localização só serve para calcular a distância até os mercados." : status.text}
      </p>
    </form>
  );
}

function Chip({
  item,
  unlocked,
  onToggleBrand,
  onRemove,
}: {
  item: ParsedLine;
  unlocked: boolean;
  onToggleBrand: () => void;
  onRemove: () => void;
}) {
  const known = item.group !== null;
  const guess = known && item.confidence < 1;
  const brand = item.product?.brand;
  const qty = known ? qtyLabel(item.qty, item.group!.unit) : "";
  const label = known ? (brand && !unlocked ? item.product!.name : item.group!.label) : item.raw;

  return (
    <li
      className={`flex items-center rounded-lg border text-[0.95rem] ${
        known ? (guess ? "border-dashed border-ink-soft bg-surface" : "border-line bg-surface") : "border-dashed border-danger"
      }`}
    >
      <span className="py-1.5 pl-3 pr-1">
        {qty && <span className="mr-1 font-semibold">{qty}</span>}
        {label}
        {guess && <span className="ml-1 text-muted">(palpite)</span>}
        {!known && <span className="ml-1 text-danger">não reconhecido</span>}
      </span>
      {brand && (
        <button
          type="button"
          onClick={onToggleBrand}
          aria-pressed={!unlocked}
          title={unlocked ? `Exigir ${brand}` : "Aceitar outra marca"}
          className={`mx-1 rounded px-1.5 py-0.5 text-[0.8rem] font-semibold ${unlocked ? "bg-muted-soft text-ink-soft" : "bg-tag text-tag-ink"}`}
        >
          {unlocked ? "Qualquer marca" : `Só ${brand}`}
        </button>
      )}
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remover ${item.raw}`}
        className="grid h-9 w-8 place-items-center rounded-r-lg text-ink-soft hover:text-ink"
      >
        <span aria-hidden="true">×</span>
      </button>
    </li>
  );
}

function Segment({
  name,
  checked,
  onChange,
  children,
}: {
  name: string;
  checked: boolean;
  onChange: () => void;
  children: React.ReactNode;
}) {
  return (
    <label
      className={`cursor-pointer rounded-lg border px-3.5 py-2 font-medium has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--focus)] ${
        checked ? "border-ink bg-ink text-paper" : "border-line bg-surface hover:border-ink-soft"
      }`}
    >
      <input type="radio" name={name} checked={checked} onChange={onChange} className="sr-only" />
      {children}
    </label>
  );
}

function CameraIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M4 8h3l2-3h6l2 3h3v11H4z" strokeLinejoin="round" />
      <circle cx="12" cy="13" r="3.5" />
    </svg>
  );
}

function locate(): Promise<LatLng | null> {
  if (!("geolocation" in navigator)) return Promise.resolve(null);
  return new Promise((resolve) =>
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => resolve(null),
      { timeout: 8000, maximumAge: 600_000 },
    ),
  );
}

/** Reduz a foto para ≤ 1600 px antes do envio (menos dados móveis, menos tokens). */
async function downscale(file: File): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return await new Promise((resolve) => canvas.toBlob((b) => resolve(b ?? file), "image/jpeg", 0.8));
  } catch {
    return file;
  }
}
