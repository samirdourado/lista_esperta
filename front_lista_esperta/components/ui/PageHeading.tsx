import type { ReactNode } from "react";

/** Page title + lead paragraph. One per page. */
export function PageHeading({ title, lead, children }: { title: ReactNode; lead?: ReactNode; children?: ReactNode }) {
  return (
    <header>
      <h1 className="font-display text-[clamp(2.4rem,10vw,3.6rem)] leading-[0.95] font-bold tracking-tight">{title}</h1>
      {lead && <p className="mt-3 max-w-[60ch] text-ink-soft">{lead}</p>}
      {children}
    </header>
  );
}
