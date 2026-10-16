import type { ReactNode, SVGProps } from "react";

/**
 * The app's icons, on a 24-unit grid in one stroke (2, round caps), coloured
 * by `currentColor`. Decorative: the control around each one carries the
 * name.
 */

export type IconProps = Omit<SVGProps<SVGSVGElement>, "children"> & { size?: number };

function Icon({ size = 24, strokeWidth = 2, children, ...rest }: IconProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  );
}

/** Three lines: the button that shows or hides the left column. */
export function MenuIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </Icon>
  );
}

export function ChevronLeftIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M14.5 6 8.5 12l6 6" />
    </Icon>
  );
}

export function ChevronRightIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="m9.5 6 6 6-6 6" />
    </Icon>
  );
}

/** A small caret, for a button that opens a menu. */
export function CaretDownIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="m7 10 5 5 5-5" />
    </Icon>
  );
}

/** The Create button's plus. */
export function PlusIcon(props: IconProps) {
  return (
    <Icon strokeWidth={2.4} {...props}>
      <path d="M12 5v14M5 12h14" />
    </Icon>
  );
}

export function SearchIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m20 20-4.2-4.2" />
    </Icon>
  );
}

export function CloseIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />
    </Icon>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="m5 12.5 4.5 4.5L19 7.5" />
    </Icon>
  );
}

export function BackIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M19 12H5M11 6l-6 6 6 6" />
    </Icon>
  );
}

/** A calendar page: the phone's Today button, with the day's number laid over it by the caller. */
export function CalendarPageIcon(props: IconProps) {
  return (
    <Icon strokeWidth={1.8} {...props}>
      <rect x="4" y="5" width="16" height="15" rx="2.5" />
      <path d="M4 9.5h16M8.5 3v4M15.5 3v4" />
    </Icon>
  );
}

/**
 * Almanac's mark, the home-screen icon's calendar page without its square
 * ground (public/icon.svg draws the same page): a header band with two rings
 * and a grid of days, one of them today. Coloured by shell.css's
 * `.app-mark__*` rules from the tokens.
 */
export function AppMark({ size = 40 }: { size?: number }) {
  return (
    <svg className="app-mark" width={size} height={size} viewBox="120 106 272 286" aria-hidden="true" focusable="false">
      <rect className="app-mark__page" x="136" y="150" width="240" height="226" rx="28" />
      <path className="app-mark__band" d="M136 214v-36a28 28 0 0 1 28-28h184a28 28 0 0 1 28 28v36z" />
      <rect className="app-mark__ring" x="190" y="122" width="28" height="60" rx="14" />
      <rect className="app-mark__ring" x="294" y="122" width="28" height="60" rx="14" />
      {[231, 279, 327].map((y) =>
        [165, 215, 265, 315].map((x) => (
          <rect key={`${x}-${y}`} className={x === 265 && y === 279 ? "app-mark__today" : "app-mark__day"} x={x} y={y} width="32" height="32" rx="8" />
        )),
      )}
    </svg>
  );
}
