/**
 * Class strings the app repeats. Every one is a whole literal, so Tailwind
 * finds it; none is built from pieces. Below 768 px (`max-md:`) is the phone,
 * where every target is 44 px.
 */

/** The round 40 px icon button (☰ ‹ ›), with a 44 px target on a phone. */
export const ICON_BUTTON = [
  "relative inline-flex size-icon-button flex-none items-center justify-center rounded-pill bg-transparent p-0 text-ink-2",
  "transition-[background-color] duration-(--duration-fast) ease-out hover:bg-hover active:bg-press",
  "max-md:before:absolute max-md:before:inset-[calc((var(--size-icon-button)-var(--size-touch))/2)]",
].join(" ");

/** The mini-month's smaller round button. */
export const ICON_BUTTON_SMALL = [
  "relative inline-flex size-icon-button-small flex-none items-center justify-center rounded-pill bg-transparent p-0 text-ink-2",
  "transition-[background-color] duration-(--duration-fast) ease-out hover:bg-hover active:bg-press",
  "max-md:before:absolute max-md:before:inset-[calc((var(--size-icon-button-small)-var(--size-touch))/2)]",
].join(" ");

/** An error or failure under a form: ink, semibold, with the drawn mark (no danger colour). */
export const ERROR_NOTE =
  "flex items-start gap-2 rounded-control bg-field px-3 py-2.5 text-meta leading-tight font-semibold text-ink";

/** The words inside an `ERROR_NOTE`. */
export const ERROR_NOTE_TEXT = "min-w-0 flex-1";

/** The dialogs: Dialog and ConfirmDialog draw the same frame. */
export const DIALOG = {
  backdrop: "fixed inset-0 z-float bg-scrim",
  // Centred by the margins: fixed, as tall as its content. Menus and popovers opened from inside share its
  // z-index and open later, so they sit above. A phone gets the whole screen.
  popup:
    "fixed inset-0 z-float m-auto flex h-fit overflow-hidden rounded-sheet bg-surface p-0 text-ink shadow-dialog max-md:h-full max-md:w-full max-md:rounded-none max-md:shadow-none",
  small: "w-[min(var(--container-dialog-small),calc(100vw-32px))]",
  medium: "w-[min(var(--container-dialog-medium),calc(100vw-32px))]",
  large: "w-[min(var(--container-dialog-large),calc(100vw-32px))]",
  // The frame moves, not the dialog, so the centring is left alone.
  frame: [
    "flex max-h-[calc(100dvh-48px)] min-w-0 flex-1 flex-col motion-safe:animate-dialog-in",
    "max-md:max-h-none max-md:pt-[env(safe-area-inset-top)] max-md:pr-[env(safe-area-inset-right)] max-md:pl-[env(safe-area-inset-left)] max-md:motion-safe:animate-sheet-in",
  ].join(" "),
  head: "flex flex-none items-center gap-2 pt-4 pr-3 pb-2 pl-6 max-md:flex-row-reverse max-md:p-2 max-md:pr-4",
  title: "min-w-0 flex-1 text-heading leading-tight font-regular text-ink",
  body: "min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 pt-2 pb-4 max-md:px-gutter-phone",
  footer: [
    "flex flex-none items-center justify-end gap-2 px-6 pt-2 pb-5",
    "max-md:border-t max-md:border-divider max-md:px-gutter-phone max-md:pt-3 max-md:pb-[max(12px,env(safe-area-inset-bottom))]",
  ].join(" "),
} as const;

/**
 * Pinned to the top, not centred: an error appearing must not move the form
 * under the pointer. Outside the shell, so the phone/desktop split is the media query.
 */
export const GATE_CLASS =
  "grid min-h-dvh items-start justify-items-center bg-ground px-gutter-phone pt-[max(14vh,64px)] pb-12 max-md:pt-[calc(env(safe-area-inset-top)+max(7vh,80px))] max-md:leading-phone";
