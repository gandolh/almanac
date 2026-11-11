import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "../lib/cn";

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

const BASE = [
  "relative inline-flex min-h-control flex-none items-center justify-center gap-1.5 rounded-control bg-transparent px-3",
  "text-center text-meta leading-tight font-regular whitespace-nowrap text-ink no-underline select-none",
  "transition-[background-color,color] duration-(--duration-fast) ease-out",
  "disabled:pointer-events-none disabled:opacity-45 aria-disabled:pointer-events-none aria-disabled:opacity-45",
].join(" ");

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "bg-accent px-4 font-semibold text-on-accent hover:bg-accent-press hover:text-on-accent active:bg-accent-press active:text-on-accent",
  // A menu's button while its menu is open keeps the tint, under the pointer too (Export in the mock-up).
  secondary: [
    "bg-control text-ink hover:bg-control-hover hover:text-ink active:bg-control-press",
    "aria-expanded:bg-accent-tint aria-expanded:font-semibold aria-expanded:text-accent-press aria-expanded:hover:bg-accent-tint aria-expanded:hover:text-accent-press aria-expanded:active:bg-accent-tint",
  ].join(" "),
  quiet: "px-1 text-body text-accent hover:text-accent-press active:text-accent-press",
};

const SIZES: Record<ButtonSize, string> = {
  compact:
    "max-md:before:absolute max-md:before:inset-x-0 max-md:before:inset-y-[calc((var(--height-control)-var(--size-touch))/2)]",
  regular: "max-md:min-h-touch max-md:px-[18px] max-md:text-body",
  large: "min-h-control-large px-6 text-action-large font-semibold",
};

/** The look of a button, for an element that is one without being `Button` (a Menu's trigger). */
export function buttonClass(
  { variant = "secondary", size = "regular", pill, block }: ButtonLook,
  extra?: string,
): string {
  return cn(
    BASE,
    VARIANTS[variant],
    SIZES[size],
    // A quiet regular button keeps its 4 px sides on a phone.
    variant === "quiet" && size === "regular" && "max-md:px-1",
    (pill || variant === "primary") && "rounded-pill",
    block && "flex w-full flex-auto",
    "[&_svg]:flex-none",
    extra,
  );
}

export interface ButtonProps extends ButtonLook, ButtonHTMLAttributes<HTMLButtonElement> {}

/** A real `<button>`, `type="button"` unless a form asks for `submit`. */
export function Button({
  variant,
  size,
  pill,
  icon,
  block,
  className,
  type = "button",
  children,
  ...rest
}: ButtonProps) {
  return (
    <button {...rest} type={type} className={buttonClass({ variant, size, pill, block }, className)}>
      {icon}
      {children}
    </button>
  );
}
