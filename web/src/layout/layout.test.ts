import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Temporal } from "temporal-polyfill";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HOME, LOGIN, SEARCH, route, viewRoute } from "../router";
import { initialOf, zoneCity } from "./AccountMenu";
import { documentTitle, placeOf } from "./AppShell";
import { registerCommand, runCommand } from "./commands";
import { MiniMonth } from "./MiniMonth";
import { isTypingTarget, shortcutFor, type KeyPress } from "./shortcuts";
import { swipeStep } from "./swipe";

const press = (key: string, extra: Partial<KeyPress> = {}): KeyPress => ({
  key,
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  shiftKey: false,
  target: { tagName: "BODY", closest: () => null } as unknown as EventTarget,
  ...extra,
});

describe("shortcutFor", () => {
  it("reads Google's keys", () => {
    expect(shortcutFor(press("t"), false)).toEqual({ kind: "today" });
    expect(shortcutFor(press("d"), false)).toEqual({ kind: "view", view: "day" });
    expect(shortcutFor(press("w"), false)).toEqual({ kind: "view", view: "week" });
    expect(shortcutFor(press("m"), false)).toEqual({ kind: "view", view: "month" });
    expect(shortcutFor(press("y"), false)).toEqual({ kind: "view", view: "year" });
    for (const key of ["j", "n", "ArrowRight"]) expect(shortcutFor(press(key), false), key).toEqual({ kind: "step", by: 1 });
    for (const key of ["k", "p", "ArrowLeft"]) expect(shortcutFor(press(key), false), key).toEqual({ kind: "step", by: -1 });
    expect(shortcutFor(press("c"), false)).toEqual({ kind: "command", name: "create" });
    expect(shortcutFor(press("/"), false)).toEqual({ kind: "command", name: "focusSearch" });
  });

  it("reads a letter typed with Caps Lock on", () => {
    expect(shortcutFor(press("M"), false)).toEqual({ kind: "view", view: "month" });
  });

  it("has nothing for other keys", () => {
    for (const key of ["x", "Enter", " ", "ArrowUp", "ArrowDown", "Escape", "1"]) expect(shortcutFor(press(key), false), key).toBeNull();
  });

  it("stays quiet with Ctrl, Alt or Meta, and with Shift except for /", () => {
    expect(shortcutFor(press("t", { ctrlKey: true }), false)).toBeNull();
    expect(shortcutFor(press("m", { metaKey: true }), false)).toBeNull();
    expect(shortcutFor(press("ArrowLeft", { altKey: true }), false)).toBeNull();
    expect(shortcutFor(press("C", { shiftKey: true }), false)).toBeNull();
    expect(shortcutFor(press("/", { shiftKey: true }), false)).toEqual({ kind: "command", name: "focusSearch" });
  });

  it("ignores keys typed into fields and editable areas", () => {
    for (const tagName of ["INPUT", "TEXTAREA", "SELECT", "input"]) {
      expect(shortcutFor(press("t", { target: { tagName } as unknown as EventTarget }), false), tagName).toBeNull();
    }
    expect(shortcutFor(press("t", { target: { tagName: "DIV", isContentEditable: true } as unknown as EventTarget }), false)).toBeNull();
  });

  it("ignores keys inside a menu or a list that uses them", () => {
    const inMenu = { tagName: "BUTTON", closest: (selector: string) => (selector.includes('[role="menu"]') ? {} : null) };
    expect(isTypingTarget(inMenu as unknown as EventTarget)).toBe(true);
    expect(shortcutFor(press("m", { target: inMenu as unknown as EventTarget }), false)).toBeNull();
    expect(isTypingTarget({ tagName: "BUTTON", closest: () => null } as unknown as EventTarget)).toBe(false);
    expect(isTypingTarget(null)).toBe(false);
  });

  it("stays quiet while a dialog, popover or menu is open", () => {
    expect(shortcutFor(press("t"), true)).toBeNull();
  });

  it("leaves a key another control already handled, or one mid-composition", () => {
    expect(shortcutFor(press("ArrowRight", { defaultPrevented: true }), false)).toBeNull();
    expect(shortcutFor(press("n", { isComposing: true }), false)).toBeNull();
  });
});

describe("swipeStep", () => {
  it("steps forward on a swipe left and back on a swipe right", () => {
    expect(swipeStep(-120, 10, 200)).toBe(1);
    expect(swipeStep(90, -20, 300)).toBe(-1);
  });

  it("leaves short, slow and mostly vertical moves alone", () => {
    expect(swipeStep(-40, 0, 100)).toBeNull();
    expect(swipeStep(-200, 0, 900)).toBeNull();
    expect(swipeStep(-100, 80, 200)).toBeNull();
  });
});

describe("commands", () => {
  it("runs the newest registration, and the one before it once that goes", () => {
    const first = vi.fn();
    const second = vi.fn();
    expect(runCommand("create")).toBe(false);
    const stopFirst = registerCommand("create", first);
    const stopSecond = registerCommand("create", second);
    expect(runCommand("create")).toBe(true);
    expect(second).toHaveBeenCalledTimes(1);
    expect(first).not.toHaveBeenCalled();
    stopSecond();
    runCommand("create");
    expect(first).toHaveBeenCalledTimes(1);
    stopFirst();
    stopFirst();
    expect(runCommand("create")).toBe(false);
  });

  it("keeps each name's handlers apart", () => {
    const focus = vi.fn();
    const stop = registerCommand("focusSearch", focus);
    expect(runCommand("create")).toBe(false);
    expect(runCommand("focusSearch")).toBe(true);
    expect(focus).toHaveBeenCalledTimes(1);
    stop();
  });
});

describe("placeOf", () => {
  const day = Temporal.PlainDate.from("2026-10-16");

  it("reads a view and its date from the address", () => {
    const place = placeOf(viewRoute("week", day));
    expect(place.kind).toBe("view");
    if (place.kind !== "view") return;
    expect(place.view).toBe("week");
    expect(place.date.toString()).toBe("2026-10-16");
  });

  it("sends home, unknown addresses and impossible dates on to today", () => {
    expect(placeOf(HOME)).toEqual({ kind: "home" });
    expect(placeOf(LOGIN)).toEqual({ kind: "home" });
    expect(placeOf(route("month", { y: "2026", m: "2", d: "30" }))).toEqual({ kind: "home" });
    expect(placeOf(route("day", { y: "x", m: "1", d: "1" }))).toEqual({ kind: "home" });
  });

  it("knows the search results", () => {
    expect(placeOf(SEARCH)).toEqual({ kind: "search" });
  });

  it("titles the document with the range", () => {
    expect(documentTitle(placeOf(viewRoute("month", day)))).toBe("October 2026 · Almanac");
    expect(documentTitle(placeOf(viewRoute("week", day)))).toBe("12 – 18 Oct 2026 · Almanac");
    expect(documentTitle(placeOf(viewRoute("year", day)))).toBe("2026 · Almanac");
    expect(documentTitle({ kind: "search" })).toBe("Search · Almanac");
    expect(documentTitle({ kind: "home" })).toBe("Almanac");
  });
});

describe("MiniMonth", () => {
  const today = Temporal.PlainDate.from("2026-10-16");

  it("titles the month, with its own previous and next", () => {
    const html = renderToStaticMarkup(createElement(MiniMonth, { date: Temporal.PlainDate.from("2026-11-03"), today, onPick: () => undefined }));
    expect(html).toContain(">November 2026</h2>");
    expect(html).toContain('aria-label="Previous month"');
    expect(html).toContain('aria-label="Next month"');
    // Monday first.
    expect(html.indexOf('abbr="Monday"')).toBeLessThan(html.indexOf('abbr="Sunday"'));
    // The shown date is marked; today (in October) is still drawn, as a day of the month before.
    expect(html).toMatch(/data-date="2026-11-03"[^>]*data-selected="true"/);
    expect(html).toMatch(/data-date="2026-10-26"[^>]*data-outside="true"/);
  });
});

describe("account menu", () => {
  it("names the zone by its city", () => {
    expect(zoneCity("Europe/Bucharest")).toBe("Bucharest");
    expect(zoneCity("America/Argentina/Buenos_Aires")).toBe("Buenos Aires");
    expect(zoneCity("UTC")).toBe("UTC");
  });

  it("puts the username's initial on the button", () => {
    expect(initialOf("ana")).toBe("A");
    expect(initialOf("  ștefan")).toBe("Ș");
    expect(initialOf("")).toBe("?");
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});
