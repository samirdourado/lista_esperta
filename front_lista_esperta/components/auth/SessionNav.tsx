"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { UserIcon } from "@/components/icons";
import { cx } from "@/lib/cx";
import { useSession, useSignOut } from "@/lib/session";

const LINK = "inline-flex min-h-tap items-center gap-1.5 rounded-full px-3 text-[0.95rem] font-medium";

/** "Entrar" for guests, the account for signed-in users. Never blocks the page. */
export function SessionNav() {
  const { data: user, isPending } = useSession();
  // Reserve the space while loading so the header does not jump.
  if (isPending) return <span aria-hidden="true" className="inline-block w-tap" />;

  if (!user) {
    return (
      <Link href="/login" className={cx(LINK, "text-ink-soft hover:text-ink")} aria-label="Entrar">
        <UserIcon />
        <span className="hidden sm:inline">Entrar</span>
      </Link>
    );
  }
  return (
    <Link
      href="/account"
      className={cx(LINK, "text-brand hover:bg-brand-soft")}
      aria-label={`Minha conta (${user.displayName})`}
    >
      <UserIcon />
      <span className="hidden max-w-32 truncate sm:inline lg:hidden xl:inline">{user.displayName}</span>
    </Link>
  );
}

/** Merchant/admin dashboards: leave the session from the header. */
export function SignOutLink() {
  const router = useRouter();
  const signOut = useSignOut();
  return (
    <button
      type="button"
      disabled={signOut.isPending}
      onClick={() => signOut.mutate(undefined, { onSettled: () => router.replace("/") })}
      className={cx(LINK, "text-ink-soft hover:text-ink disabled:opacity-50")}
    >
      Sair
    </button>
  );
}
