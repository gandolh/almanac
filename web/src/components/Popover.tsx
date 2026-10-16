import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { layerFor } from "./layer";

/**
 * A white floating panel anchored to an element or a rectangle: quick create
 * and the event details beside an event (briefs 06, 07), a day's list in the
 * year view (brief 08). Mounted means open: render it to show it, stop
 * rendering it to hide it.
 *
 * - `placement: "below"` hangs under the anchor, lined up with its start,
 *   and flips above when there is no room; `"side"` sits to its right, flips
 *   to its left, and lines up with its top. Either way it is kept inside the
 *   window.
 * - Esc and a press outside call `onClose` (a press on the anchor element
 *   doesn't, so the anchor's own click can toggle).
 * - It is a non-modal `role="dialog"`: focus moves into it on open (the
 *   first `[data-autofocus]`, else the first focusable, else the panel) and
 *   back to where it was on close. While one is open the app's keyboard
 *   shortcuts are off.
 * - Portalled to `body`, or into the open `<dialog>` its anchor is in.
 */
export interface PopoverProps {
  anchor: Element | DOMRect;
  onClose: () => void;
  children: ReactNode;
  placement?: "below" | "side";
  /** The accessible name; or `labelledBy`, the id of a heading inside. */
  label?: string;
  labelledBy?: string;
  className?: string;
  /** Move focus into the panel on open. Default true. */
  autoFocus?: boolean;
}

export interface Rect {
  top: number;
  left: number;
  right: number;
  bottom: number;
}

export interface Size {
  width: number;
  height: number;
}

const GAP = 8; // between the anchor and the panel
const MARGIN = 8; // the panel never comes closer to the window's edge than this

/** Where the panel goes (`top`, `left` in the window), for a placement, kept inside the window. */
export function placePopover(anchor: Rect, panel: Size, viewport: Size, placement: "below" | "side"): { top: number; left: number } {
  const clamp = (value: number, size: number, room: number) => Math.max(MARGIN, Math.min(value, room - size - MARGIN));
  if (placement === "below") {
    const below = anchor.bottom + GAP;
    const above = anchor.top - GAP - panel.height;
    const fitsBelow = below + panel.height <= viewport.height - MARGIN;
    const top = fitsBelow || above < MARGIN ? below : above;
    return { top: clamp(top, panel.height, viewport.height), left: clamp(anchor.left, panel.width, viewport.width) };
  }
  const right = anchor.right + GAP;
  const left = anchor.left - GAP - panel.width;
  let x: number;
  if (right + panel.width <= viewport.width - MARGIN) x = right;
  else if (left >= MARGIN) x = left;
  // No room on either side (a wide day column, a phone): over the anchor, centred on it.
  else x = (anchor.left + anchor.right) / 2 - panel.width / 2;
  return { top: clamp(anchor.top, panel.height, viewport.height), left: clamp(x, panel.width, viewport.width) };
}

const FOCUSABLE = 'a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])';

export function Popover({ anchor, onClose, children, placement = "below", label, labelledBy, className, autoFocus = true }: PopoverProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [layer] = useState<HTMLElement>(() => layerFor(anchor instanceof Element ? anchor : null));
  const onCloseRef = useRef(onClose);

  useLayoutEffect(() => {
    onCloseRef.current = onClose;
  });

  // Placed in the window, following the anchor while the page scrolls or the window resizes.
  useLayoutEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    let last: Rect = anchor instanceof Element ? anchor.getBoundingClientRect() : anchor;
    const place = () => {
      // An anchor element that left the page (a view re-rendered) keeps its last place.
      if (anchor instanceof Element && anchor.isConnected) last = anchor.getBoundingClientRect();
      const { top, left } = placePopover(
        last,
        { width: panel.offsetWidth, height: panel.offsetHeight },
        { width: window.innerWidth, height: window.innerHeight },
        placement,
      );
      panel.style.top = `${Math.round(top)}px`;
      panel.style.left = `${Math.round(left)}px`;
      panel.dataset.placed = "";
    };
    place();
    const observer = new ResizeObserver(place);
    observer.observe(panel);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [anchor, placement]);

  // Focus in on open, back on close.
  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    const before = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (autoFocus) {
      const target = panel.querySelector<HTMLElement>("[data-autofocus]") ?? panel.querySelector<HTMLElement>(FOCUSABLE) ?? panel;
      target.focus({ preventScroll: true });
    }
    return () => {
      const active = document.activeElement;
      const lost = active === null || active === document.body || panel.contains(active) || !panel.isConnected;
      if (lost && before?.isConnected) before.focus({ preventScroll: true });
    };
  }, [autoFocus]);

  // Esc and a press outside close it.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      // Ours, not the dialog's behind it.
      event.preventDefault();
      onCloseRef.current();
    };
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (panelRef.current?.contains(target)) return;
      if (anchor instanceof Element && anchor.contains(target)) return;
      onCloseRef.current();
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [anchor]);

  return createPortal(
    <div
      ref={panelRef}
      role="dialog"
      aria-label={labelledBy ? undefined : label}
      aria-labelledby={labelledBy}
      tabIndex={-1}
      className={className ? `popover ${className}` : "popover"}
      data-placement={placement}
    >
      {children}
    </div>,
    layer,
  );
}
