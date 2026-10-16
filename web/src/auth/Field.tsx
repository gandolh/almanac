import { useId, type InputHTMLAttributes, type Ref } from "react";
import { AlertIcon } from "./icons";

export interface AuthFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "className"> {
  label: string;
  /** What is wrong with the value, under the field; marks it invalid. */
  error?: string;
  /** A quiet note under the field, when there is no error. */
  hint?: string;
  ref?: Ref<HTMLInputElement>;
}

/**
 * A label over a filled field: the login page's fields and the password
 * dialog's. Brief 07's event editor may share the look.
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
