"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";

/**
 * A panel over the page, like a mobile menu: from the bottom on phones, from
 * the right on wide screens. Native <dialog>: focus stays inside, Esc and the
 * backdrop close it, and the page behind is inert.
 */
export function Sheet({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (open && !element.open) element.showModal?.();
    if (!open && element.open) element.close();
  }, [open]);

  return (
    <dialog
      ref={dialog}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(event) => {
        // A click on the backdrop lands on the dialog itself.
        if (event.target === event.currentTarget) onClose();
      }}
      className="sheet"
    >
      <div className="flex max-h-[inherit] flex-col">
        <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-2">
          <h2 id={titleId} className="text-xl font-bold">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="size-tap shrink-0 rounded-full text-2xl text-ink-soft hover:bg-surface-sunken"
          >
            ×
          </button>
        </header>
        <div className="overflow-y-auto px-4 pt-4 pb-[calc(env(safe-area-inset-bottom)+1.5rem)]">
          {open && children}
        </div>
      </div>
    </dialog>
  );
}
