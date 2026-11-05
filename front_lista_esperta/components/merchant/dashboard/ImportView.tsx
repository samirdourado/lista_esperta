"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { errorMessage } from "@/lib/api/errors";
import { CSV_TEMPLATE, IMPORT_ERROR } from "@/lib/merchant/labels";
import { useImportCsv } from "@/lib/merchant/queries";
import { useStoreId } from "./StoreShell";

const IMPORT_FILE_ERROR: Record<string, string> = {
  MISSING_COLUMNS: "A planilha precisa de uma coluna de preço e de uma coluna de código de barras ou nome.",
  EMPTY_FILE: "A planilha está vazia.",
  TOO_MANY_ROWS: "Envie no máximo 2.000 linhas por arquivo.",
  NOT_CSV: "Salve a planilha como CSV antes de enviar (Arquivo › Salvar como › CSV).",
};

function downloadTemplate() {
  const blob = new Blob(["﻿" + CSV_TEMPLATE], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "modelo-precos-lista-esperta.csv";
  link.click();
  URL.revokeObjectURL(url);
}

export function ImportView() {
  const storeId = useStoreId();
  const importCsv = useImportCsv(storeId);
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const report = importCsv.data;
  const failure = importCsv.error;
  const failureCode =
    failure && typeof failure === "object" && "code" in failure ? (failure as { code?: string }).code : undefined;

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div className="text-ink-soft">
        <p>Envie uma planilha em CSV com uma linha por produto. Colunas aceitas:</p>
        <ul className="mt-2 list-disc pl-5">
          <li>
            <strong className="text-ink">codigo</strong> (código de barras) ou{" "}
            <strong className="text-ink">nome</strong>
          </li>
          <li>
            <strong className="text-ink">preco</strong>, como 12,90
          </li>
          <li>
            <strong className="text-ink">oferta ate</strong> (opcional): a linha vira oferta válida até essa data
          </li>
          <li>
            <strong className="text-ink">categoria</strong>, <strong className="text-ink">unidade</strong> e{" "}
            <strong className="text-ink">quantidade</strong> (opcionais): para cadastrar produtos novos sem código
          </li>
        </ul>
        <button
          type="button"
          onClick={downloadTemplate}
          className="mt-3 min-h-tap font-semibold text-brand underline underline-offset-4"
        >
          Baixar planilha de exemplo
        </button>
      </div>

      <form
        className="flex flex-col gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          if (file) importCsv.mutate(file);
        }}
      >
        <label htmlFor="csv-file" className="font-medium">
          Arquivo CSV
        </label>
        <input
          id="csv-file"
          ref={input}
          type="file"
          accept=".csv,text/csv"
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          className="block w-full rounded-md border border-line-strong bg-surface p-2 file:mr-3 file:min-h-tap file:rounded-full file:border-0 file:bg-brand-soft file:px-4 file:font-semibold file:text-brand"
        />
        <Button type="submit" size="lg" loading={importCsv.isPending} disabled={!file} className="self-start">
          Importar preços
        </Button>
      </form>

      {importCsv.isError && (
        <Notice tone="danger" title={(failureCode && IMPORT_FILE_ERROR[failureCode]) || errorMessage(failure)} />
      )}
      {report && (
        <div className="flex flex-col gap-3" role="status">
          <Notice
            tone={report.errors.length ? "warning" : "success"}
            title={`${report.pricesSaved} de ${report.rowsRead} preços salvos`}
          >
            {report.productsCreated > 0 && <p>{report.productsCreated} produtos novos cadastrados no catálogo.</p>}
            {report.errors.length > 0 && (
              <p>{report.errors.length} linhas não foram importadas. Corrija e envie só elas de novo.</p>
            )}
          </Notice>
          {report.errors.length > 0 && (
            <ul className="divide-y divide-line rounded-md border border-line bg-surface text-[0.95rem]">
              {report.errors.slice(0, 100).map((error) => (
                <li key={`${error.line}-${error.code}`} className="px-4 py-2">
                  Linha {error.line}: {IMPORT_ERROR[error.code] ?? error.code}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
