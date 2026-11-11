import { cn } from "../lib/cn";

/**
 * The event form's and quick create's class strings (event/EventForm.tsx,
 * QuickCreate.tsx, RepeatPicker.tsx, TimeField.tsx): filled fields on the
 * `field` colour, rows of a 20 px icon in a fixed column and the control
 * beside it. Below 768 px is the phone, where every target is 44 px.
 */

/** A filled field: text, select, date and the time field's input. An invalid one is marked by an outline as well as the text under it, never by colour alone. */
export const INPUT = [
  "box-border h-editor-field w-full min-w-0 rounded-field bg-field px-3 text-meta text-ink max-md:h-touch",
  "focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-focus-ring",
  "aria-invalid:outline-[1.5px] aria-invalid:-outline-offset-[1.5px] aria-invalid:outline-ink-2",
  "aria-invalid:focus-visible:outline-2 aria-invalid:focus-visible:outline-offset-0 aria-invalid:focus-visible:outline-focus-ring",
].join(" ");

/** A native select: a little less room at the end, for the browser's arrow. */
export const SELECT = cn(INPUT, "pe-2");

/** A select as wide as its longest choice: the reminder and the repeat. */
export const SELECT_WIDE = cn(SELECT, "w-fit max-w-full min-w-60");

/** The calendar picker's select. */
export const SELECT_CALENDAR = cn(SELECT, "w-fit max-w-full min-w-50");

/** The notes: grows with its rows, and by hand. */
export const NOTES = cn(INPUT, "h-auto min-h-24 resize-y py-2.5 leading-body max-md:h-auto");

/** The title: large, with a line under it that turns accent when focused. */
export const TITLE =
  "box-border w-full rounded-none border-0 border-b border-hairline bg-transparent py-1.5 text-range leading-[1.3] text-ink focus-visible:-mb-px focus-visible:border-b-2 focus-visible:border-accent focus-visible:outline-none";

export const ERROR = "text-small leading-tight font-semibold text-ink";
export const HINT = "text-small leading-tight text-muted";

/** A checkbox with its label. */
export const CHECK = "inline-flex min-h-8 w-fit items-center gap-2 text-meta text-ink max-md:min-h-touch";
export const CHECK_BOX = "m-0 size-[18px] accent-accent";
