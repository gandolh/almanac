import { cn } from "../lib/cn";

/**
 * The event form's and quick create's class strings (event/EventForm.tsx,
 * QuickCreate.tsx, RepeatPicker.tsx, TimeField.tsx): filled fields on the
 * `field` colour with an outline edge, a visible label over each, rows of a
 * 20 px icon in a fixed column and the control beside it. Below 768 px is the phone, where every target is 44 px.
 */

/** A filled field: text, select, date and the time field's input. An invalid one has a danger edge as well as the words under it, never colour alone. */
export const INPUT = [
  "box-border h-editor-field w-full min-w-0 rounded-field border border-outline bg-field px-3 text-input-phone text-ink max-md:h-(--size-touch)",
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring",
  "aria-invalid:border-danger",
].join(" ");

/** A native select: a little less room at the end, for the browser's arrow. */
export const SELECT = cn(INPUT, "pe-2");

/** A select as wide as its longest choice: the reminder and the repeat. */
export const SELECT_WIDE = cn(SELECT, "w-full");

/** The calendar picker's select. */
export const SELECT_CALENDAR = cn(SELECT, "w-full");

/** The notes: grows with its rows, and by hand. */
export const NOTES = cn(INPUT, "h-auto min-h-[72px] resize-y py-2.5 leading-[22px] max-md:h-auto");

/** The title: a field like the others, larger: 48 px, 22 px semibold. */
export const TITLE = cn(INPUT, "h-12 text-range font-semibold max-md:h-13");

/** A field's label, over it. */
export const LABEL = "text-small leading-[18px] font-semibold text-muted";

export const ERROR = "text-small leading-tight font-semibold text-danger";
export const HINT = "text-small leading-tight text-muted";

/** A checkbox with its label. */
export const CHECK = "inline-flex min-h-8 w-fit items-center gap-2 text-meta text-ink max-md:min-h-(--size-touch)";
export const CHECK_BOX = "m-0 size-[18px] accent-accent";
