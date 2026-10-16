import type { Calendar, Occurrence } from "@almanac/shared";
import { Fragment, createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DayHead, eventContent, eventTimeText, slotLabel, weekdayHead } from "./content";
import {
  VIEW_TYPES,
  clickEnd,
  displayTitle,
  eventInk,
  moveChanges,
  occurrenceOf,
  occurrencePatch,
  plainDateOf,
  toEventInputs,
  wireSpan,
} from "./events";
import { holdSelection, releaseSelection } from "./selection";

const BUCHAREST = "Europe/Bucharest";

function calendar(id: number, extra: Partial<Calendar> = {}): Calendar {
  return {
    id,
    name: `Calendar ${id}`,
    color: "blue",
    visible: true,
    position: id,
    createdAt: "2026-10-16T09:00:00Z",
    updatedAt: "2026-10-16T09:00:00Z",
    ...extra,
  };
}

function occurrence(id: string, extra: Partial<Occurrence> = {}): Occurrence {
  return {
    id,
    eventId: 1,
    seriesId: null,
    originalStart: null,
    calendarId: 1,
    title: "Standup",
    location: "",
    notes: "",
    allDay: false,
    start: "2026-10-16T07:00:00Z",
    end: "2026-10-16T07:30:00Z",
    repeat: null,
    ...extra,
  };
}

describe("toEventInputs", () => {
  const work = calendar(1, { color: "teal" });
  const gym = calendar(2, { color: "yellow" });
  const hidden = calendar(3, { visible: false });

  it("keeps the wire times and colours each event from its calendar", () => {
    const timed = occurrence("e1");
    const [event] = toEventInputs([timed], [work]);
    expect(event).toEqual({
      id: "e1",
      title: "Standup",
      start: "2026-10-16T07:00:00Z",
      end: "2026-10-16T07:30:00Z",
      allDay: false,
      color: "#009688",
      contrastColor: "var(--on-accent)",
      extendedProps: { occurrence: timed },
    });
    expect(occurrenceOf(event as { extendedProps: Record<string, unknown> })).toBe(timed);
  });

  it("passes all-day dates through, end exclusive", () => {
    const [event] = toEventInputs([occurrence("e2", { allDay: true, start: "2026-10-16", end: "2026-10-18", calendarId: 2 })], [gym]);
    expect(event).toMatchObject({ allDay: true, start: "2026-10-16", end: "2026-10-18", color: "#F6BF26", contrastColor: "var(--ink)" });
  });

  it("drops hidden calendars and calendars it doesn't know (still loading, or just deleted)", () => {
    const events = toEventInputs(
      [occurrence("e1"), occurrence("e2", { calendarId: 2 }), occurrence("e3", { calendarId: 3 }), occurrence("e4", { calendarId: 9 })],
      [work, gym, hidden],
    );
    expect(events.map((event) => event.id)).toEqual(["e1", "e2"]);
    expect(toEventInputs([occurrence("e1")], [])).toEqual([]);
  });

  it("writes an empty title as Google does", () => {
    expect(toEventInputs([occurrence("e1", { title: "" })], [work])[0]?.title).toBe("(No title)");
    expect(displayTitle("  ")).toBe("(No title)");
    expect(displayTitle("Gym")).toBe("Gym");
  });

  it("an occurrence-less event (a selection's mirror) has none", () => {
    expect(occurrenceOf({ extendedProps: {} })).toBe(null);
  });
});

describe("eventInk", () => {
  it("is white on the palette's colours and ink on its light yellow", () => {
    for (const hex of ["#4285F4", "#009688", "#33B679", "#7CB342", "#F4511E", "#D50000", "#E67C73", "#8E24AA", "#616161"]) {
      expect(eventInk(hex), hex).toBe("var(--on-accent)");
    }
    expect(eventInk("#F6BF26")).toBe("var(--ink)");
  });
});

describe("FullCalendar's dates back on the wire", () => {
  // FullCalendar's Dates are real instants: midnight in Bucharest is 21:00 UTC the day before in October.
  const midnight16 = new Date("2026-10-15T21:00:00Z");
  const midnight18 = new Date("2026-10-17T21:00:00Z");

  it("takes an all-day date in the display time zone, and a timed one as the instant", () => {
    expect(plainDateOf(midnight16, BUCHAREST).toString()).toBe("2026-10-16");
    expect(plainDateOf(midnight16, "UTC").toString()).toBe("2026-10-15");
    expect(wireSpan(new Date("2026-10-16T07:15:30.500Z"), new Date("2026-10-16T08:15:30.500Z"), false, BUCHAREST)).toEqual({
      start: "2026-10-16T07:15:30Z",
      end: "2026-10-16T08:15:30Z",
      allDay: false,
    });
  });

  it("makes a span, filling in an end FullCalendar left out", () => {
    expect(wireSpan(midnight16, midnight18, true, BUCHAREST)).toEqual({ start: "2026-10-16", end: "2026-10-18", allDay: true });
    expect(wireSpan(midnight16, null, true, BUCHAREST)).toEqual({ start: "2026-10-16", end: "2026-10-17", allDay: true });
    const ten = new Date("2026-10-16T07:00:00Z");
    expect(wireSpan(ten, new Date("2026-10-16T08:30:00Z"), false, BUCHAREST)).toEqual({
      start: "2026-10-16T07:00:00Z",
      end: "2026-10-16T08:30:00Z",
      allDay: false,
    });
    expect(wireSpan(ten, null, false, BUCHAREST)).toEqual({ start: "2026-10-16T07:00:00Z", end: "2026-10-16T08:00:00Z", allDay: false });
  });

  it("crosses a change of clocks by the instant: an all-day span over the October change stays whole days", () => {
    // Bucharest goes from +03:00 to +02:00 on 25 October 2026.
    expect(wireSpan(new Date("2026-10-24T21:00:00Z"), new Date("2026-10-25T22:00:00Z"), true, BUCHAREST)).toEqual({
      start: "2026-10-25",
      end: "2026-10-26",
      allDay: true,
    });
  });

  it("widens a click (one snap on the hours) to an hour and leaves drags alone", () => {
    const snap = 15 * 60_000;
    const ten = new Date("2026-10-16T07:00:00Z");
    expect(clickEnd(ten, new Date("2026-10-16T07:15:00Z"), false, snap)?.toISOString()).toBe("2026-10-16T08:00:00.000Z");
    expect(clickEnd(ten, new Date("2026-10-16T07:30:00Z"), false, snap)).toBe(null);
    expect(clickEnd(midnight16, new Date("2026-10-16T21:00:00Z"), true, snap)).toBe(null);
  });
});

describe("a drag's patch", () => {
  const span = { start: "2026-10-16T08:00:00Z", end: "2026-10-16T08:30:00Z", allDay: false };

  it("sends allDay only when the event moved between the all-day row and the hours", () => {
    expect(moveChanges({ allDay: false }, span)).toEqual({ start: span.start, end: span.end });
    expect(moveChanges({ allDay: true }, span)).toEqual({ start: span.start, end: span.end, allDay: false });
  });

  it("names the scope and the original start for a series, nothing more for a one-off", () => {
    const changes = { start: span.start, end: span.end };
    expect(occurrencePatch(occurrence("e1"), changes, null)).toEqual({ changes });
    const generated = occurrence("s7:2026-10-16T07:00:00Z", { eventId: 7, seriesId: 7, originalStart: "2026-10-16T07:00:00Z" });
    expect(occurrencePatch(generated, changes, "following")).toEqual({ scope: "following", occurrence: "2026-10-16T07:00:00Z", changes });
    // An exception: its own row, the series' key.
    const moved = occurrence("e12", { eventId: 12, seriesId: 7, originalStart: "2026-10-16T07:00:00Z", start: "2026-10-16T09:00:00Z" });
    expect(occurrencePatch(moved, changes, "this")).toEqual({ scope: "this", occurrence: "2026-10-16T07:00:00Z", changes });
  });
});

describe("the views' words", () => {
  it("names FullCalendar's views", () => {
    expect(VIEW_TYPES).toEqual({ day: "timeGridDay", week: "timeGridWeek", month: "dayGridMonth" });
  });

  it("labels the hours and the events' times on a 24-hour clock", () => {
    const at = (hour: number, minute: number) => ({ hour, minute });
    expect(slotLabel({ date: at(8, 0), start: at(8, 0) })).toBe("08:00");
    expect(eventTimeText({ date: at(14, 30), start: at(14, 30), end: at(16, 0) })).toBe("14:30 – 16:00");
    expect(eventTimeText({ date: at(9, 5), start: at(9, 5), end: null })).toBe("09:05");
  });

  it("heads the columns MON to SUN, with today's date marked", () => {
    expect([1, 2, 3, 4, 5, 6, 0].map(weekdayHead)).toEqual(["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"]);
    const html = renderToStaticMarkup(createElement(DayHead, { dow: 1, dayNumber: "19", today: true }));
    expect(html).toBe(
      '<span class="cal-head cal-head--today"><span class="cal-head__weekday">MON</span><span class="cal-head__day">19</span></span>',
    );
    expect(renderToStaticMarkup(createElement(DayHead, { dow: 0, dayNumber: "", today: false }))).toBe(
      '<span class="cal-head"><span class="cal-head__weekday">SUN</span></span>',
    );
  });
});

describe("an event's inside", () => {
  const block = { timeText: "10:00 – 11:00", timeClass: "time", titleClass: "title" };

  it("is FullCalendar's own for events, dragged ones too", () => {
    expect(eventContent({ ...block, isMirror: false, event: { title: "Standup" } })).toBe(true);
    expect(eventContent({ ...block, isMirror: true, event: { title: "Standup" } })).toBe(true);
  });

  it("writes (No title) over the time of a selection's block", () => {
    const inside = eventContent({ ...block, isMirror: true, event: { title: "" } });
    expect(inside).not.toBe(true);
    expect(renderToStaticMarkup(createElement(Fragment, null, inside as ReactNode))).toBe(
      '<div class="time">10:00 – 11:00</div><div class="title">(No title)</div>',
    );
  });
});

describe("the selection", () => {
  it("is let go through whichever view holds it", () => {
    let cleared = 0;
    const unhold = holdSelection(() => {
      cleared += 1;
    });
    releaseSelection();
    unhold();
    releaseSelection();
    expect(cleared).toBe(1);
  });
});
