"use client";

import Link from "next/link";
import { useSession } from "@/lib/session";

/** Shown to guests after a verdict: an advantage, never a gate. */
export function SaveListsInvite() {
  const { data: user, isPending } = useSession();
  if (isPending || user) return null;
  return (
    <p className="mt-10 border-t border-line pt-6 text-[0.95rem] text-ink-soft">
      Salve suas listas e acesse de qualquer aparelho.{" "}
      <Link href="/register" className="font-semibold text-brand underline underline-offset-4">
        Criar conta grátis
      </Link>
    </p>
  );
}
