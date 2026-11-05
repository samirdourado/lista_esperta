import type { ReactNode } from "react";
import { cx } from "@/lib/cx";
import { AlertIcon, CheckIcon, InfoIcon } from "@/components/icons";

export type NoticeTone = "info" | "success" | "warning" | "danger";

const TONE: Record<NoticeTone, { box: string; icon: ReactNode }> = {
  info: { box: "border-brand-line bg-brand-soft text-ink", icon: <InfoIcon className="text-brand" /> },
  success: { box: "border-success/30 bg-success-soft text-ink", icon: <CheckIcon className="text-success" /> },
  warning: { box: "border-warning/30 bg-warning-soft text-ink", icon: <AlertIcon className="text-warning" /> },
  danger: { box: "border-danger/30 bg-danger-soft text-ink", icon: <AlertIcon className="text-danger" /> },
};

/**
 * Inline message. `danger` is announced immediately (role="alert");
 * the other tones are polite (role="status").
 */
export function Notice({
  tone = "info",
  title,
  children,
  action,
  className,
}: {
  tone?: NoticeTone;
  title?: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  const style = TONE[tone];
  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      className={cx("flex gap-3 rounded-md border px-4 py-3 text-[0.95rem]", style.box, className)}
    >
      <span className="mt-0.5 shrink-0" aria-hidden="true">
        {style.icon}
      </span>
      <div className="min-w-0 flex-1">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={cx(title ? "mt-0.5" : null, "text-ink-soft")}>{children}</div>}
        {action && <div className="mt-2">{action}</div>}
      </div>
    </div>
  );
}
