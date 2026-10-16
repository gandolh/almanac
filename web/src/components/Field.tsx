import { useId, type InputHTMLAttributes, type Ref } from "react";
import "../auth/auth.css";

/**
 * The error mark beside a field or form error: a 24-unit grid, round caps,
 * coloured by `currentColor`. There is no danger colour: an error is ink,
 * semibold, with this mark. Decorative; the text says it.
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
    >
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.8v4.9" />
      <path d="M12 16.2h.01" strokeWidth={2.6} />
    </svg>
  );
}

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
 * dialog's, the time zone search and the new-calendar name. Its look
 * (`.auth-field*`) is in auth/auth.css.
 */
export function AuthField({ label, error, hint, ref, ...input }: AuthFieldProps) {
  const id = useId();
  const noteId = `${id}-note`;
  const note = error ?? hint;
  return (
    <div className="auth-field">
      <label className="auth-field__label" htmlFor={id}>
        {label}
      </label>
      <input
        {...input}
        ref={ref}
        id={id}
        className="auth-field__input"
        aria-invalid={error !== undefined || undefined}
        aria-describedby={note ? noteId : undefined}
      />
      {error !== undefined ? (
        <p id={noteId} className="auth-field__error">
          <AlertIcon size={16} />
          {error}
        </p>
      ) : (
        hint && (
          <p id={noteId} className="auth-field__hint">
            {hint}
          </p>
        )
      )}
    </div>
  );
}
