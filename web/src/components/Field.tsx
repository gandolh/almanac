import { useId, type InputHTMLAttributes, type Ref } from "react";

/**
 * The error mark beside a field or form error: a 24-unit grid, round caps,
 * coloured by `currentColor`. An error is
 * danger-coloured and semibold, with this mark and always its words. Decorative; the text says it.
 */
export function AlertIcon({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className="-mt-px flex-none"
    >
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.8v4.9" />
      <path d="M12 16.2h.01" strokeWidth={2.6} />
    </svg>
  );
}

/** One field height with the event editor; 16 px type, so iOS doesn't zoom into it. */
const INPUT_CLASS = [
  "h-editor-field w-full appearance-none rounded-field border border-outline bg-field px-3 text-input-phone text-ink max-md:h-(--size-touch)",
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring",
  "aria-invalid:border-danger",
].join(" ");

export interface AuthFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "className"> {
  label: string;
  /** What is wrong with the value, under the field; marks it invalid. */
  error?: string;
  /** A quiet note under the field, when there is no error. */
  hint?: string;
  ref?: Ref<HTMLInputElement>;
}

/**
 * A label over a filled field: the login page's fields, the password
 * dialog's, the time zone search and the new-calendar name.
 */
export function AuthField({ label, error, hint, ref, ...input }: AuthFieldProps) {
  const id = useId();
  const noteId = `${id}-note`;
  const note = error ?? hint;
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label className="text-small leading-tight font-semibold text-muted" htmlFor={id}>
        {label}
      </label>
      <input
        {...input}
        ref={ref}
        id={id}
        className={INPUT_CLASS}
        aria-invalid={error !== undefined || undefined}
        aria-describedby={note ? noteId : undefined}
      />
      {error !== undefined ? (
        <p id={noteId} className="flex items-start gap-1.5 text-small leading-tight font-semibold text-danger">
          <AlertIcon size={16} />
          {error}
        </p>
      ) : (
        hint && (
          <p id={noteId} className="text-small leading-tight text-muted">
            {hint}
          </p>
        )
      )}
    </div>
  );
}
