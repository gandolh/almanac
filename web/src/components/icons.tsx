import type { ReactNode, SVGProps } from "react";

/**
 * The app's icons, on a 24-unit grid in one stroke (2, round caps), coloured
 * by `currentColor`. Decorative: the control around each one carries the
 * name. 24 px unless `size` says otherwise; the event editor and the details
 * popover draw theirs at 20.
 */

export type IconProps = Omit<SVGProps<SVGSVGElement>, "children"> & { size?: number };

/** The frame every icon draws in; for an icon that is needed in one place only. */
export function Icon({ size = 24, strokeWidth = 2, children, ...rest }: IconProps & { children: ReactNode }) {
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

/** A calendar page: which calendar an event is on. */
export function CalendarIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="4" y="5" width="16" height="15" rx="2.5" />
      <path d="M4 9.5h16M8.5 3v4M15.5 3v4" />
    </Icon>
  );
}

/** The same page, a finer line: the phone's Today button, with the day's number laid over it by the caller. */
export function CalendarPageIcon(props: IconProps) {
  return <CalendarIcon strokeWidth={1.8} {...props} />;
}

// --- Events: the event form's rows and the details popover --------------------------

/** When an event happens. */
export function ClockIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </Icon>
  );
}

/** A bell: the event's reminder (brief 15). */
export function BellIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M6.5 16.5V11a5.5 5.5 0 0 1 11 0v5.5l1.5 1.5H5z" />
      <path d="M10 20.5a2.2 2.2 0 0 0 4 0" />
    </Icon>
  );
}

/** How it repeats. */
export function RepeatIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4.5 11V9.5a3 3 0 0 1 3-3H18M15 3.5l3 3-3 3M19.5 13v1.5a3 3 0 0 1-3 3H6M9 20.5l-3-3 3-3" />
    </Icon>
  );
}

/** Where: a map pin. */
export function PlaceIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z" />
      <circle cx="12" cy="10" r="2.3" />
    </Icon>
  );
}

/** The notes: lines of text. */
export function NotesIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M5 6.5h14M5 11h14M5 15.5h9" />
    </Icon>
  );
}

/** A pencil: Edit. */
export function EditIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 20h4L18.5 9.5a2.1 2.1 0 0 0-3-3L5 17v3" />
      <path d="m13.5 8.5 2 2" />
    </Icon>
  );
}

/** A bin: Delete. */
export function DeleteIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4.5 7h15M10 11v6M14 11v6M6.5 7l1 12a1.5 1.5 0 0 0 1.5 1.4h6a1.5 1.5 0 0 0 1.5-1.4l1-12M9.5 7V4.5h5V7" />
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
