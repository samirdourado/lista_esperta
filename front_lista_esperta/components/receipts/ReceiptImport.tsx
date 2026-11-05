"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { CheckIcon, ReceiptIcon } from "@/components/icons";
import { Button } from "@/components/ui/Button";
import { TextAreaField } from "@/components/ui/Field";
import { Notice } from "@/components/ui/Notice";
import { ApiError, errorMessage } from "@/lib/api/errors";
import { brl } from "@/lib/format";
import {
  RECEIPT_ERROR,
  useImportPhoto,
  useImportQr,
  useKeyInfo,
  type AccessKeyInfo,
  type ReceiptResult,
} from "@/lib/receipts/queries";
import { useSession } from "@/lib/session";
import { QrScanner } from "./QrScanner";

function failure(error: unknown): string {
  if (error instanceof ApiError && error.code && RECEIPT_ERROR[error.code]) return RECEIPT_ERROR[error.code];
  return errorMessage(error, { 429: "Muitas notas seguidas. Espere um minuto." });
}

const KEY_ERROR: Record<string, string> = {
  LENGTH: "A chave de acesso tem 44 números. Confira se está completa.",
  CHECK_DIGIT: "Algum número da chave está errado (o dígito verificador não confere).",
  UF: "Os dois primeiros números não são de um estado brasileiro.",
  MODEL: "Essa chave não é de uma nota fiscal de consumidor.",
};

/** QR by camera, photo, pasted link or typed key: every receipt feeds the prices nearby. */
export function ReceiptImport() {
  const [scanning, setScanning] = useState(false);
  const [text, setText] = useState("");
  const [keyInfo, setKeyInfo] = useState<AccessKeyInfo | null>(null);
  const photoInput = useRef<HTMLInputElement>(null);
  const qr = useImportQr();
  const photo = useImportPhoto();
  const key = useKeyInfo();
  const result = qr.data ?? photo.data;
  const error = qr.error ?? photo.error ?? key.error;
  const busy = qr.isPending || photo.isPending;

  const reset = () => {
    qr.reset();
    photo.reset();
    key.reset();
    setKeyInfo(null);
  };

  const onScan = (value: string) => {
    setScanning(false);
    qr.mutate(value);
  };

  const submitText = async () => {
    reset();
    const value = text.trim();
    if (/^https?:\/\//i.test(value)) qr.mutate(value);
    else setKeyInfo(await key.mutateAsync(value));
  };

  if (result)
    return (
      <ReceiptDone
        result={result}
        onAnother={() => {
          reset();
          setText("");
        }}
      />
    );

  return (
    <div className="mt-8 flex flex-col gap-6">
      {busy && (
        <p role="status" className="flex items-center gap-2 font-medium">
          <ReceiptIcon className="text-brand" />
          {photo.isPending ? "Lendo a foto da nota… isso pode levar alguns segundos." : "Buscando a nota na SEFAZ…"}
        </p>
      )}
      {error && !busy && (
        <Notice tone={error instanceof ApiError && error.status === 409 ? "info" : "danger"} title={failure(error)} />
      )}

      {scanning ? (
        <QrScanner onResult={onScan} onCancel={() => setScanning(false)} />
      ) : (
        <div className="flex flex-wrap gap-3">
          <Button
            size="lg"
            onClick={() => {
              reset();
              setScanning(true);
            }}
            disabled={busy}
          >
            Escanear o QR Code
          </Button>
          <Button size="lg" variant="secondary" onClick={() => photoInput.current?.click()} disabled={busy}>
            Enviar foto da nota
          </Button>
          <input
            ref={photoInput}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            capture="environment"
            className="sr-only"
            tabIndex={-1}
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) {
                reset();
                photo.mutate(file);
              }
            }}
          />
        </div>
      )}

      <details className="rounded-md border border-line bg-surface p-4">
        <summary className="min-h-tap cursor-pointer font-medium">
          Colar o link do QR Code ou digitar a chave de acesso
        </summary>
        <form
          className="mt-3 flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            void submitText().catch(() => undefined);
          }}
        >
          <TextAreaField
            label="Link do QR Code ou chave de 44 números"
            hint="A chave fica no rodapé da nota, em grupos de 4 números."
            rows={3}
            value={text}
            onChange={(event) => setText(event.target.value)}
          />
          <Button type="submit" loading={key.isPending || qr.isPending} disabled={!text.trim()} className="self-start">
            Enviar
          </Button>
        </form>
        {keyInfo && <KeyInfoNotice info={keyInfo} />}
      </details>

      <p className="text-[0.9rem] text-ink-soft">
        Usamos só os itens, os preços, a loja e o horário. A nota não tem seu nome nem seu CPF, a não ser que você tenha
        pedido CPF na nota; mesmo assim, não guardamos.
      </p>
    </div>
  );
}

function KeyInfoNotice({ info }: { info: AccessKeyInfo }) {
  if (!info.valid)
    return <Notice tone="danger" title={KEY_ERROR[info.error ?? ""] ?? "Chave inválida."} className="mt-3" />;
  if (info.alreadySent) return <Notice tone="info" title="Essa nota já foi enviada. Obrigado!" className="mt-3" />;
  return (
    <Notice tone="info" title="Chave válida" className="mt-3">
      Nota de {info.uf}, emitida em {info.month?.split("-").reverse().join("/")}. Só com a chave a SEFAZ exige um
      captcha, então não conseguimos ler os itens. Escaneie o QR Code ou envie uma foto da nota.
    </Notice>
  );
}

function ReceiptDone({ result, onAnother }: { result: ReceiptResult; onAnother: () => void }) {
  const { data: user } = useSession();
  const pending = result.lines.filter((line) => line.status !== "MATCHED").length;
  return (
    <div className="mt-8 flex flex-col gap-5">
      <Notice
        tone="success"
        title={`${result.pricesAdded} ${result.pricesAdded === 1 ? "preço adicionado" : "preços adicionados"}. Obrigado!`}
      >
        Os preços desta nota já ajudam quem compra perto de {result.store.name}.
        {pending > 0 &&
          ` ${pending} ${pending === 1 ? "item ainda vai" : "itens ainda vão"} ser conferidos pela nossa equipe.`}
      </Notice>
      <div className="rounded-md border border-line bg-surface">
        <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line px-4 py-3">
          <span className="font-semibold">{result.store.name}</span>
          <span className="text-[0.95rem] text-ink-soft">
            {new Date(result.issuedAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })} ·{" "}
            {brl(result.total)}
          </span>
        </div>
        <ul className="divide-y divide-line">
          {result.lines.map((line, index) => (
            <li key={index} className="flex items-start justify-between gap-3 px-4 py-2.5">
              <span className="min-w-0">
                <span className="block truncate">{line.productName ?? line.description}</span>
                <span className="text-[0.85rem] text-ink-soft">
                  {line.quantity.toLocaleString("pt-BR")} {line.unit.toLowerCase()} × {brl(line.unitPrice)}
                  {line.status === "PENDING" && " · em conferência"}
                  {line.status === "UNMATCHED" && " · não reconhecido"}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-1 tabular-nums">
                {line.status === "MATCHED" && <CheckIcon className="text-success" aria-label="Preço adicionado" />}
                {brl(line.totalPrice)}
              </span>
            </li>
          ))}
        </ul>
      </div>
      <div className="flex flex-wrap gap-3">
        <Button onClick={onAnother}>Enviar outra nota</Button>
        <Link
          href="/"
          className="inline-flex min-h-tap items-center px-2 font-semibold text-brand underline underline-offset-4"
        >
          Voltar para a lista
        </Link>
      </div>
      {!user && (
        <p className="text-[0.95rem] text-ink-soft">
          Quer guardar o histórico das suas notas?{" "}
          <Link href="/register" className="font-semibold text-brand underline underline-offset-4">
            Criar conta grátis
          </Link>
        </p>
      )}
    </div>
  );
}
