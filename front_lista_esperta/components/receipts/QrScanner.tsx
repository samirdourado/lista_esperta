"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";

/**
 * Reads the QR code with the camera, on the device (spec section 6).
 * Only the text of the code is sent to the API.
 */
export function QrScanner({ onResult, onCancel }: { onResult: (text: string) => void; onCancel: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string>();
  const done = useRef(false);
  // Kept in a ref so a new callback from the parent never restarts the camera.
  const onResultRef = useRef(onResult);
  useEffect(() => {
    onResultRef.current = onResult;
  }, [onResult]);

  useEffect(() => {
    let stop: (() => void) | undefined;
    let cancelled = false;
    void (async () => {
      try {
        const { BrowserQRCodeReader } = await import("@zxing/browser");
        if (cancelled || !video.current) return;
        const reader = new BrowserQRCodeReader();
        const controls = await reader.decodeFromConstraints(
          { video: { facingMode: { ideal: "environment" } } },
          video.current,
          (result) => {
            if (!result || done.current) return;
            done.current = true;
            controls.stop();
            onResultRef.current(result.getText());
          },
        );
        stop = () => controls.stop();
        if (cancelled) stop();
      } catch (e) {
        const denied = e instanceof DOMException && (e.name === "NotAllowedError" || e.name === "SecurityError");
        setError(
          denied
            ? "O navegador não liberou a câmera. Libere nas configurações ou envie uma foto da nota."
            : "Não conseguimos abrir a câmera neste aparelho. Envie uma foto da nota ou cole o link do QR Code.",
        );
      }
    })();
    return () => {
      cancelled = true;
      stop?.();
    };
  }, []);

  return (
    <div className="flex flex-col gap-3">
      {error ? (
        <Notice tone="warning" title={error} />
      ) : (
        <div className="relative overflow-hidden rounded-md bg-ink">
          <video
            ref={video}
            className="aspect-square w-full object-cover"
            muted
            playsInline
            aria-label="Câmera para ler o QR Code"
          />
          {/* Viewfinder */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-[18%] rounded-lg border-4 border-accent"
          />
          <p className="absolute inset-x-0 bottom-0 bg-ink/70 px-3 py-2 text-center text-[0.95rem] text-paper">
            Aponte para o QR Code no fim da nota
          </p>
        </div>
      )}
      <Button variant="ghost" onClick={onCancel} className="self-start">
        Fechar câmera
      </Button>
    </div>
  );
}
