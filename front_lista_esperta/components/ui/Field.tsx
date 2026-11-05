import { useId, type InputHTMLAttributes, type ReactNode, type Ref, type TextareaHTMLAttributes } from "react";
import { cx } from "@/lib/cx";

const CONTROL =
  "block w-full rounded-md border bg-surface px-3.5 text-ink placeholder:text-muted " +
  "focus:border-brand focus:outline-none focus-visible:outline-3 focus-visible:outline-offset-1 " +
  "disabled:bg-surface-sunken disabled:text-muted";

type FieldChrome = {
  label: ReactNode;
  /** Short help shown below the label. */
  hint?: ReactNode;
  /** Validation message; also marks the control as invalid. */
  error?: string;
  /** Keeps the label for screen readers only. */
  hideLabel?: boolean;
};

function useFieldIds(id?: string) {
  const generated = useId();
  const controlId = id ?? generated;
  return { controlId, hintId: `${controlId}-hint`, errorId: `${controlId}-error` };
}

function Chrome({
  controlId,
  hintId,
  errorId,
  label,
  hint,
  error,
  hideLabel,
  children,
}: FieldChrome & { controlId: string; hintId: string; errorId: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={controlId} className={cx("font-medium text-ink", hideLabel && "sr-only")}>
        {label}
      </label>
      {hint && (
        <p id={hintId} className="text-[0.9rem] text-ink-soft">
          {hint}
        </p>
      )}
      {children}
      {error && (
        <p id={errorId} className="text-[0.9rem] font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

function describedBy(hint: unknown, error: unknown, hintId: string, errorId: string) {
  return cx(hint ? hintId : null, error ? errorId : null) || undefined;
}

type TextFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "children"> &
  FieldChrome & { ref?: Ref<HTMLInputElement> };

export function TextField({ id, label, hint, error, hideLabel, className, ...input }: TextFieldProps) {
  const ids = useFieldIds(id);
  return (
    <Chrome {...ids} label={label} hint={hint} error={error} hideLabel={hideLabel}>
      <input
        id={ids.controlId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(hint, error, ids.hintId, ids.errorId)}
        className={cx(CONTROL, "min-h-tap", error ? "border-danger" : "border-line-strong", className)}
        {...input}
      />
    </Chrome>
  );
}

type TextAreaFieldProps = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "children"> &
  FieldChrome & { ref?: Ref<HTMLTextAreaElement> };

export function TextAreaField({ id, label, hint, error, hideLabel, className, ...textarea }: TextAreaFieldProps) {
  const ids = useFieldIds(id);
  return (
    <Chrome {...ids} label={label} hint={hint} error={error} hideLabel={hideLabel}>
      <textarea
        id={ids.controlId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(hint, error, ids.hintId, ids.errorId)}
        className={cx(CONTROL, "py-2.5", error ? "border-danger" : "border-line-strong", className)}
        {...textarea}
      />
    </Chrome>
  );
}
