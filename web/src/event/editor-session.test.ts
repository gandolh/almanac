import { describe, expect, it } from "vitest";
import { quickSession, type QuickCreateInit, type Session } from "./editor-session";

// Node has no DOM: an anchor is only compared by identity here.
const cell = {} as Element;
const redrawn = {} as Element;
const monday: QuickCreateInit = { start: "2026-10-19", end: "2026-10-20", allDay: true, anchor: cell };

describe("quickSession", () => {
  it("opens quick create when nothing is open, or something else is", () => {
    expect(quickSession(null, monday, 1)).toEqual({ kind: "quick", key: 1, init: monday });
    const form: Session = { kind: "create", key: 1, seed: {} };
    expect(quickSession(form, monday, 2)).toEqual({ kind: "quick", key: 2, init: monday });
  });

  it("keeps the open one when its own selection is pressed again, hanging it from the selection as now drawn", () => {
    const open = quickSession(null, monday, 1);
    // Same key, so what was typed stays; the new ask, so the title gets the focus back.
    const again = { ...monday };
    const kept = quickSession(open, again, 2);
    expect(kept).toEqual({ kind: "quick", key: 1, init: monday });
    expect(kept.kind === "quick" && kept.init).toBe(again);
    // FullCalendar drew the selection anew: the new element is the anchor.
    expect(quickSession(open, { ...monday, anchor: redrawn }, 3)).toEqual({ kind: "quick", key: 1, init: { ...monday, anchor: redrawn } });
  });

  it("opens a fresh one for another span", () => {
    const open = quickSession(null, monday, 1);
    expect(quickSession(open, { ...monday, end: "2026-10-21" }, 2)).toMatchObject({ key: 2, init: { end: "2026-10-21" } });
    expect(quickSession(open, { ...monday, start: "2026-10-20", end: "2026-10-21" }, 3)).toMatchObject({ key: 3 });
    const timed: QuickCreateInit = { start: "2026-10-19T07:00:00Z", end: "2026-10-19T08:00:00Z", allDay: false, anchor: cell };
    expect(quickSession(open, timed, 4)).toMatchObject({ key: 4, init: { allDay: false } });
  });
});
