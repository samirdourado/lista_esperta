import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cx } from "@/lib/cx";
import { Spinner } from "./Spinner";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "md" | "lg";

const VARIANT: Record<ButtonVariant, string> = {
  primary: "bg-brand text-on-brand hover:bg-brand-strong",
  secondary: "border border-brand bg-surface text-brand hover:bg-brand-soft",
  ghost: "text-ink-soft hover:bg-surface-sunken hover:text-ink",
  danger: "bg-danger text-surface hover:opacity-90",
};

const SIZE: Record<ButtonSize, string> = {
  // Both sizes keep the 44 px minimum touch target.
  md: "min-h-tap px-4 text-[0.95rem]",
  lg: "min-h-12 px-6 text-lg",
};

type ButtonStyleOptions = { variant?: ButtonVariant; size?: ButtonSize; block?: boolean };

/** Classes for anything that should look like a button, including `<Link>`. */
export function buttonClasses({ variant = "primary", size = "md", block = false }: ButtonStyleOptions = {}): string {
  return cx(
    "inline-flex items-center justify-center gap-2 rounded-full font-semibold whitespace-nowrap",
    "transition-colors disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50",
    VARIANT[variant],
    SIZE[size],
    block && "w-full",
  );
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  ButtonStyleOptions & {
    /** Shows a spinner, keeps the label for screen readers and blocks repeated clicks. */
    loading?: boolean;
    icon?: ReactNode;
  };

export function Button({
  variant,
  size,
  block,
  loading = false,
  icon,
  type = "button",
  disabled,
  className,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cx(buttonClasses({ variant, size, block }), className)}
      {...rest}
    >
      {loading ? <Spinner /> : icon}
      {children}
    </button>
  );
}
