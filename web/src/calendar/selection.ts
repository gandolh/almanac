/**
 * The selection a click or drag on empty time leaves in the day, week or
 * month view (the shaded block quick create hangs from). It stays until
 * whoever opened quick create lets it go: call `releaseSelection()` when
 * quick create closes, however it closes (saved, discarded, Esc, "More
 * options" handing over to the event form). A press elsewhere in the page
 * clears it too; a press inside a popover or dialog doesn't.
 */

let release: (() => void) | null = null;

/** The view's side: what clears its selection, while it is mounted. Returns the unregister function. */
export function holdSelection(clear: () => void): () => void {
  release = clear;
  return () => {
    if (release === clear) release = null;
  };
}

/** Clear the view's selection, if there is one. Safe to call at any time. */
export function releaseSelection(): void {
  release?.();
}
