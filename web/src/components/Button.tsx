import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "../lib/cn";

/**
 * The four buttons, all with 10 px corners:
 *
 * - `primary`: the accent fill, one per view ("Sign in", "Save", "Create").
 * - `secondary`: a flat fill on `control` ("Sign in with Ward", "Sign out").
 * - `quiet`: outlined on the surface ("Cancel", "Edit", "Try again").
 * - `danger`: danger-coloured text, no fill, with its label ("Delete").
 *
 * Sizes: `regular` is 36 px on the desktop and 44 px on a phone; `large` is
 * 48 px everywhere (a sheet's primary action); `compact` stays 36 px and
 * keeps a 44 px target on a phone with an invisible margin, for toolbar rows.
 */
export type ButtonVariant = "primary" | "secondary" | "quiet" | "danger";
export type ButtonSize = "compact" | "regular" | "large";

interface ButtonLook {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Drawn before the label. */
  icon?: ReactNode;
  /** Take the whole width of the row. */
  block?: boolean;
}

const BASE = [
  "relative inline-flex min-h-control flex-none items-center justify-center gap-1.5 rounded-control bg-transparent px-4",
  "text-center text-meta leading-tight font-semibold whitespace-nowrap text-ink no-underline select-none",
  "transition-[background-color,color] duration-(--duration-fast) ease-out",
  "disabled:pointer-events-none disabled:opacity-45 aria-disabled:pointer-events-none aria-disabled:opacity-45",
].join(" ");

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "bg-accent text-on-accent hover:bg-accent-press hover:text-on-accent active:bg-accent-press active:text-on-accent",
  // A menu's button while its menu is open keeps the tint, under the pointer too.
  secondary: [
    "bg-control text-ink hover:bg-control-hover hover:text-ink active:bg-control-press",
    "aria-expanded:bg-accent-tint aria-expanded:text-accent-ink aria-expanded:hover:bg-accent-tint aria-expanded:active:bg-accent-tint",
  ].join(" "),
  quiet: "border border-outline bg-surface text-ink hover:bg-field active:bg-control-press",
  danger: "px-3 text-danger hover:bg-hover active:bg-press",
};

const SIZES: Record<ButtonSize, string> = {
  compact:
    "max-md:before:absolute max-md:before:inset-x-0 max-md:before:inset-y-[calc((var(--height-control)-var(--size-touch))/2)]",
  regular: "max-md:min-h-(--size-touch) max-md:px-[18px] max-md:text-body",
  large: "min-h-control-large px-6 text-action-large",
};

/** The look of a button, for an element that is one without being `Button` (a Menu's trigger). */
export function buttonClass({ variant = "secondary", size = "regular", block }: ButtonLook, extra?: string): string {
  return cn(BASE, VARIANTS[variant], SIZES[size], block && "flex w-full flex-auto", "[&_svg]:flex-none", extra);
}

export interface ButtonProps extends ButtonLook, ButtonHTMLAttributes<HTMLButtonElement> {}

/** A real `<button>`, `type="button"` unless a form asks for `submit`. */
export function Button({ variant, size, icon, block, className, type = "button", children, ...rest }: ButtonProps) {
  return (
    <button {...rest} type={type} className={buttonClass({ variant, size, block }, className)}>
      {icon}
      {children}
    </button>
  );
}
