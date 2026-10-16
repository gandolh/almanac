import type { ButtonHTMLAttributes, ReactNode } from "react";

/**
 * The three buttons:
 *
 * - `primary`: the accent pill, one per view ("Sign in", "Change password").
 * - `secondary`: a flat fill on `control` ("Sign in with Ward", "Sign out"); `pill` rounds it fully.
 * - `quiet`: accent text, no fill ("Cancel", "Dismiss").
 *
 * Sizes: `regular` is 34 px on the desktop and 44 px on a phone; `large` is
 * 48 px everywhere (a sheet's primary action); `compact` stays 34 px and
 * keeps a 44 px target on a phone with an invisible margin, for toolbar rows.
 */
export type ButtonVariant = "primary" | "secondary" | "quiet";
export type ButtonSize = "compact" | "regular" | "large";

interface ButtonLook {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Fully round ends for a secondary button (the primary always has them). */
  pill?: boolean;
  /** Drawn before the label. */
  icon?: ReactNode;
  /** Take the whole width of the row. */
  block?: boolean;
}

function buttonClass({ variant = "secondary", size = "regular", pill, block }: ButtonLook, extra?: string): string {
  return [
    "button",
    `button--${variant}`,
    `button--${size}`,
    pill || variant === "primary" ? "button--pill" : null,
    block ? "button--block" : null,
    extra,
  ]
    .filter(Boolean)
    .join(" ");
}

export interface ButtonProps extends ButtonLook, ButtonHTMLAttributes<HTMLButtonElement> {}

/** A real `<button>`, `type="button"` unless a form asks for `submit`. */
export function Button({ variant, size, pill, icon, block, className, type = "button", children, ...rest }: ButtonProps) {
  return (
    <button {...rest} type={type} className={buttonClass({ variant, size, pill, block }, className)}>
      {icon}
      {children}
    </button>
  );
}
