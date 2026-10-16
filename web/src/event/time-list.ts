/**
 * Where a time field's list of times opens: under the field, lined up with
 * its left edge, unless that would leave what can be seen. On a phone the
 * times sit at the right of the form, where such a list would run off the
 * screen, so it lines up with the field's right edge instead. In a short
 * window it is cut to the room under the field, or opens over the field when
 * there is more room there. What can be seen is the window (less the
 * on-screen keyboard) cut by every scrolling box around the field, such as
 * the event form's body, which ends where its buttons start.
 */

export interface Box {
  top: number;
  left: number;
  right: number;
  bottom: number;
}

export interface TimeListPlacement {
  /** Lined up with the field's left edge (`start`) or its right edge (`end`). */
  align: "start" | "end";
  side: "below" | "above";
  /** How tall the list may be to stay in its room; `null` keeps the stylesheet's height. */
  maxHeight: number | null;
}

/** Between the field and the list: editor.css's `calc(100% + 4px)`. */
const GAP = 4;
/** The list keeps this far from the edge of its room. */
const MARGIN = 8;

/** The list's place, for the field's box, the list's own size (its stylesheet height at most), and the room it has. */
export function placeTimeList(field: Box, list: { width: number; height: number }, room: Box): TimeListPlacement {
  const pastRight = Math.max(0, field.left + list.width - (room.right - MARGIN));
  const pastLeft = Math.max(0, room.left + MARGIN - (field.right - list.width));
  const align = pastRight <= pastLeft ? "start" : "end";

  const below = Math.floor(room.bottom - MARGIN - (field.bottom + GAP));
  const above = Math.floor(field.top - GAP - (room.top + MARGIN));
  if (list.height <= below) return { align, side: "below", maxHeight: null };
  if (above > below) return { align, side: "above", maxHeight: list.height <= above ? null : Math.max(0, above) };
  return { align, side: "below", maxHeight: Math.max(0, below) };
}

/**
 * What can be seen around `element`: the visual viewport, cut by every box
 * around it that clips what overflows, up to the dialog it is in (a modal
 * dialog sits above the page, unclipped by what holds it in the document).
 */
export function roomAround(element: Element): Box {
  const viewport = window.visualViewport;
  const room: Box = viewport
    ? { top: viewport.offsetTop, left: viewport.offsetLeft, right: viewport.offsetLeft + viewport.width, bottom: viewport.offsetTop + viewport.height }
    : { top: 0, left: 0, right: document.documentElement.clientWidth, bottom: window.innerHeight };
  for (let box = element.parentElement; box !== null; box = box.parentElement) {
    const { overflowX, overflowY } = getComputedStyle(box);
    if (overflowX !== "visible" || overflowY !== "visible") {
      const rect = box.getBoundingClientRect();
      room.top = Math.max(room.top, rect.top);
      room.left = Math.max(room.left, rect.left);
      room.right = Math.min(room.right, rect.right);
      room.bottom = Math.min(room.bottom, rect.bottom);
    }
    if (box instanceof HTMLDialogElement) break;
  }
  return room;
}
