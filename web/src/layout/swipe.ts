import { useEffect, useRef, type RefObject } from "react";
import { isTypingTarget } from "./shortcuts";

/**
 * The phone's ‹ ›: a quick horizontal swipe across the view, as in Google's
 * app (the phone's top bar has no room for the buttons). Touch only; a
 * mostly vertical move is a scroll and is left alone. A view that uses
 * horizontal drags itself marks that element `data-no-swipe`.
 */

const MIN_DISTANCE = 60; // px
const MAX_MS = 600;

/** Which way a finished touch steps: `1` (swiped left, next), `-1` (swiped right, previous), or `null`. */
export function swipeStep(dx: number, dy: number, ms: number): 1 | -1 | null {
  if (ms > MAX_MS || Math.abs(dx) < MIN_DISTANCE || Math.abs(dx) < 2 * Math.abs(dy)) return null;
  return dx < 0 ? 1 : -1;
}

export function useSwipe(target: RefObject<HTMLElement | null>, enabled: boolean, onStep: (by: 1 | -1) => void): void {
  const handler = useRef(onStep);
  useEffect(() => {
    handler.current = onStep;
  });
  useEffect(() => {
    const element = target.current;
    if (!element || !enabled) return;
    let start: { x: number; y: number; at: number } | null = null;
    const onStart = (event: TouchEvent) => {
      const touch = event.touches[0];
      const from = event.target as Element | null;
      start =
        event.touches.length === 1 && touch && !isTypingTarget(from) && !from?.closest?.("[data-no-swipe]")
          ? { x: touch.clientX, y: touch.clientY, at: event.timeStamp }
          : null;
    };
    const onEnd = (event: TouchEvent) => {
      const touch = event.changedTouches[0];
      if (!start || !touch) return;
      const step = swipeStep(touch.clientX - start.x, touch.clientY - start.y, event.timeStamp - start.at);
      start = null;
      if (step !== null) handler.current(step);
    };
    const onCancel = () => {
      start = null;
    };
    element.addEventListener("touchstart", onStart, { passive: true });
    element.addEventListener("touchend", onEnd, { passive: true });
    element.addEventListener("touchcancel", onCancel, { passive: true });
    return () => {
      element.removeEventListener("touchstart", onStart);
      element.removeEventListener("touchend", onEnd);
      element.removeEventListener("touchcancel", onCancel);
    };
  }, [target, enabled]);
}
