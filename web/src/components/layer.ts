/**
 * Where a floating thing (a menu, a popover) is portalled to. A modal
 * `<dialog>` makes everything outside it inert, so a menu opened from inside
 * one must live inside it too; anything else goes to `body`. An anchor that
 * is only a rectangle takes the last open dialog, if there is one.
 */
export function layerFor(anchor: Element | null): HTMLElement {
  const own = anchor?.closest<HTMLDialogElement>("dialog[open]");
  if (own) return own;
  if (anchor === null) {
    const open = document.querySelectorAll<HTMLDialogElement>("dialog[open]");
    const last = open[open.length - 1];
    if (last) return last;
  }
  return document.body;
}
