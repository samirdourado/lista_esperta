import { cx } from "@/lib/cx";

/** Placeholder block. Wrap a group of skeletons in an element with aria-busy and a visible status text. */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cx("skeleton-pulse rounded-sm bg-surface-sunken", className)} />;
}
