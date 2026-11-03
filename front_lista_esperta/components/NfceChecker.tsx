"use client";

import { useId, useRef, useState } from "react";
import { formatCnpj, parseChave, type ChaveResult } from "@/lib/nfce";

const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

interface BarcodeDetectorLike {
  detect(source: ImageBitmapSource): Promise<Array<{ rawValue: string }>>;
}
declare global {
  interface Window {
    BarcodeDetector?: new (opts: { formats: string[] }) => BarcodeDetectorLike;
  }
}

export function NfceChecker() {
  const inputId = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState("");
  const [result, setResult] = useState<ChaveResult | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);

  const check = (text: string) => setResult(text.trim() ? parseChave(text) : null);

  async function scan(file: File) {
    setScanError(null);
    if (!window.BarcodeDetector) {
      setScanError("Este navegador não lê QR Code de foto. Use o leitor da câmera do celular e cole o link abaixo.");
      return;
    }
    try {
      const detector = new window.BarcodeDetector({ formats: ["qr_code"] });
      const codes = await detector.detect(await createImageBitmap(file));
      if (codes.length === 0) {
        setScanError("Nenhum QR Code encontrado na foto. Enquadre só o código, com boa luz.");
        return;
      }
      setValue(codes[0].rawValue);
      check(codes[0].rawValue);
    } catch {
      setScanError("Não foi possível ler a foto. Tente de novo ou cole o link do QR Code.");
    }
  }

  return (
    <div className="mt-8">
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        className="w-full rounded-full bg-ink px-6 py-4 font-display text-2xl font-semibold text-paper hover:opacity-90"
      >
        Fotografar o QR Code
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
          if (f) void scan(f);
        }}
      />
      {scanError && (
        <p role="alert" className="mt-3 text-danger">
          {scanError}
        </p>
      )}

      <form
        className="mt-8"
        onSubmit={(e) => {
          e.preventDefault();
          check(value);
        }}
      >
        <label htmlFor={inputId} className="font-display text-xl font-semibold">
          Ou cole o link do QR Code ou a chave de 44 dígitos
        </label>
        <div className="mt-2 flex gap-2">
          <input
            id={inputId}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            inputMode="url"
            autoComplete="off"
            className="min-w-0 flex-1 rounded-lg border border-line bg-surface px-3 py-2.5 focus:border-ink focus:outline-none"
          />
          <button type="submit" className="shrink-0 rounded-lg border border-ink px-4 font-medium">
            Conferir nota
          </button>
        </div>
      </form>

      <div aria-live="polite" className="mt-6">
        {result?.ok === false && <p className="text-danger">{result.error}</p>}
        {result?.ok && (
          <section className="border-l-4 border-save bg-surface px-4 py-4">
            <h2 className="font-display text-2xl font-bold text-save">Nota válida</h2>
            <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5">
              <dt className="text-ink-soft">Loja (CNPJ)</dt>
              <dd className="tabular-nums">{formatCnpj(result.value.cnpj)}</dd>
              <dt className="text-ink-soft">Estado</dt>
              <dd>{result.value.uf}</dd>
              <dt className="text-ink-soft">Emitida em</dt>
              <dd>
                {MONTHS[result.value.issuedMonth - 1] ?? "mês inválido"} de {result.value.issuedYear}
              </dd>
              <dt className="text-ink-soft">Número</dt>
              <dd className="tabular-nums">
                {Number(result.value.number)}, série {Number(result.value.series)}
              </dd>
            </dl>
            {result.value.contingency && (
              <p className="mt-3 text-[0.95rem]">
                Emitida em contingência: a Sefaz pode levar algumas horas para disponibilizar os itens.
              </p>
            )}
            <p className="mt-3 text-[0.95rem] text-ink-soft">
              Conferimos a chave aqui no aparelho. A leitura dos itens na Sefaz ainda não está ligada nesta versão, então
              esta nota não entra na base de preços.
            </p>
          </section>
        )}
      </div>
    </div>
  );
}
