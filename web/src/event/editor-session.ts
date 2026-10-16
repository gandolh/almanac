import type { Occurrence } from "@almanac/shared";
import type { FormSeed } from "./editor-state";

/**
 * What the event editor has open (`EventEditorProvider`), and how a new ask
 * for quick create changes it, as plain values the tests run in Node.
 */

export interface CreateInit {
  /** A `…Z` instant, or `YYYY-MM-DD` when `allDay`. */
  start?: string;
  end?: string;
  allDay?: boolean;
}

export interface QuickCreateInit {
  start: string;
  end: string;
  allDay: boolean;
  /** What quick create's popover hangs from: the selection's element or rectangle. */
  anchor: Element | DOMRect;
}

/** What is open. `key` makes each opening a fresh form, whatever was open before. */
export type Session =
  | { kind: "quick"; key: number; init: QuickCreateInit }
  | { kind: "create"; key: number; seed: FormSeed }
  | { kind: "edit"; key: number; occurrence: Occurrence };

/**
 * The session once quick create is asked for `init`. A press on the shaded
 * selection quick create already hangs from selects the same span again
 * (month and the all-day row): that keeps the open one under its key, with
 * what was typed in it, now hanging from the selection as it is drawn (the
 * new `init`). Anything else opens a fresh one under `key`.
 */
export function quickSession(current: Session | null, init: QuickCreateInit, key: number): Session {
  if (current?.kind === "quick" && sameSpan(current.init, init)) return { ...current, init };
  return { kind: "quick", key, init };
}

function sameSpan(a: QuickCreateInit, b: QuickCreateInit): boolean {
  return a.start === b.start && a.end === b.end && a.allDay === b.allDay;
}
