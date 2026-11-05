"use client";

import { useOffline } from "next/offline";
import { OfflineIcon } from "@/components/icons";

export function OfflineBanner() {
  const offline = useOffline();
  return (
    <div role="status" aria-live="polite">
      {offline && (
        <p className="flex items-center justify-center gap-2 bg-ink px-4 py-2 text-center text-[0.9rem] font-medium text-paper">
          <OfflineIcon />
          Sem internet. As páginas que você já abriu continuam disponíveis.
        </p>
      )}
    </div>
  );
}
