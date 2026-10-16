import type { Occurrence, Repeat } from "@almanac/shared";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Temporal } from "../dates";
import {
  changedFields,
  changesRepeat,
  chooseEnd,
  choosePreset,
  currentRepeat,
  defaultSpan,
  draftOfOccurrence,
  draftOfSeed,
  durationLabel,
  endTimeOptions,
  errorPlace,
  eventInputOf,
  hasProblems,
  parseTimeText,
  pickCalendar,
  problemsOf,
  readLastCalendar,
  rememberCalendar,
  repeatDraftOf,
  repeatLabelDate,
  repeatOf,
  repeatOptions,
  repeatSummary,
  sameRepeat,
  scopeQuestion,
  startTimeOptions,
  titleOf,
  toggleDay,
  wireTimesOf,
  withAllDay,
  withEnd,
  withStart,
  type EventDraft,
} from "./editor-state";

const BUCHAREST = "Europe/Bucharest";

/** Friday 16 October 2026, 14:20 in Bucharest (UTC+3 until the 25th). */
const NOW = Temporal.Instant.from("2026-10-16T11:20:00Z");

function draft(extra: Partial<EventDraft> = {}): EventDraft {
  return { ...draftOfSeed({ start: "2026-10-20T07:00:00Z", end: "2026-10-20T08:30:00Z" }, BUCHAREST, NOW), ...extra };
}

function occurrence(extra: Partial<Occurrence> = {}): Occurrence {
  return {
    id: "e1",
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

/** Every Friday from 16 October, 10:00 in Bucharest. */
function weekly(extra: Partial<Occurrence> = {}): Occurrence {
  return occurrence({
    id: "s7:2026-10-23T07:00:00Z",
    eventId: 7,
    seriesId: 7,
    originalStart: "2026-10-23T07:00:00Z",
    start: "2026-10-23T07:00:00Z",
    end: "2026-10-23T07:30:00Z",
    repeat: { freq: "weekly", byDay: ["FR"], end: { type: "never" } },
    ...extra,
  });
}

describe("a new event's default span", () => {
  it("starts at the next full hour in the display time zone and lasts an hour", () => {
    const { start, end } = defaultSpan(BUCHAREST, NOW);
    expect(start.toString()).toBe("2026-10-16T15:00:00");
    expect(end.toString()).toBe("2026-10-16T16:00:00");
    // The same instant on another clock.
    expect(defaultSpan("UTC", NOW).start.toString()).toBe("2026-10-16T12:00:00");
  });

  it("goes to the next hour on the hour, and to the next day after 23:00", () => {
    expect(defaultSpan(BUCHAREST, Temporal.Instant.from("2026-10-16T11:00:00Z")).start.toString()).toBe("2026-10-16T15:00:00");
    const late = defaultSpan(BUCHAREST, Temporal.Instant.from("2026-10-16T20:30:00Z"));
    expect(late.start.toString()).toBe("2026-10-17T00:00:00");
    expect(late.end.toString()).toBe("2026-10-17T01:00:00");
  });

  it("fills a new draft's fields", () => {
    const fresh = draftOfSeed({}, BUCHAREST, NOW);
    expect(fresh).toMatchObject({
      title: "",
      calendarId: null,
      allDay: false,
      startDate: "2026-10-16",
      startTime: "15:00",
      endDate: "2026-10-16",
      endTime: "16:00",
      repeatTouched: false,
      origin: null,
    });
    expect(fresh.repeat.preset).toBe("none");
  });
});

describe("a form opened with times", () => {
  it("shows a selection's instants on the display clock", () => {
    const opened = draftOfSeed({ start: "2026-10-20T07:00:00Z", end: "2026-10-20T08:30:00Z", title: "Plan", calendarId: 3 }, BUCHAREST, NOW);
    expect(opened).toMatchObject({ title: "Plan", calendarId: 3, startDate: "2026-10-20", startTime: "10:00", endDate: "2026-10-20", endTime: "11:30" });
  });

  it("gives an end-less start an hour, and a backwards end an hour", () => {
    expect(draftOfSeed({ start: "2026-10-20T07:00:00Z" }, BUCHAREST, NOW)).toMatchObject({ startTime: "10:00", endTime: "11:00" });
    expect(draftOfSeed({ start: "2026-10-20T07:00:00Z", end: "2026-10-20T06:00:00Z" }, BUCHAREST, NOW)).toMatchObject({ endTime: "11:00" });
  });

  it("shows an all-day end as its last day (the wire's end is exclusive)", () => {
    const opened = draftOfSeed({ start: "2026-10-16", end: "2026-10-18", allDay: true }, BUCHAREST, NOW);
    expect(opened).toMatchObject({ allDay: true, startDate: "2026-10-16", endDate: "2026-10-17" });
    expect(wireTimesOf(opened, BUCHAREST)).toEqual({ start: "2026-10-16", end: "2026-10-18", allDay: true });
  });

  it("takes a timed start given as a date at the default hour", () => {
    expect(draftOfSeed({ start: "2026-10-20" }, BUCHAREST, NOW)).toMatchObject({ startDate: "2026-10-20", startTime: "15:00", endTime: "16:00" });
  });
});

describe("moving the start", () => {
  it("keeps the duration: the end follows a new start time", () => {
    const moved = withStart(draft(), { startTime: "14:00" });
    expect(moved).toMatchObject({ startTime: "14:00", endDate: "2026-10-20", endTime: "15:30" });
  });

  it("follows a new start date, and across midnight", () => {
    expect(withStart(draft(), { startDate: "2026-10-22" })).toMatchObject({ endDate: "2026-10-22", endTime: "11:30" });
    const late = withStart(draft(), { startTime: "23:30" });
    expect(late).toMatchObject({ endDate: "2026-10-21", endTime: "01:00" });
  });

  it("keeps an all-day event's number of days", () => {
    const days = draftOfSeed({ start: "2026-10-16", end: "2026-10-19", allDay: true }, BUCHAREST, NOW);
    expect(withStart(days, { startDate: "2026-10-20" })).toMatchObject({ startDate: "2026-10-20", endDate: "2026-10-22" });
  });

  it("leaves an end that is already before the start alone", () => {
    const backwards = draft({ endTime: "09:00" });
    expect(withStart(backwards, { startTime: "10:30" })).toMatchObject({ startTime: "10:30", endTime: "09:00" });
  });

  it("moves nothing while a date is half typed", () => {
    expect(withStart(draft(), { startDate: "" })).toMatchObject({ startDate: "", endDate: "2026-10-20", endTime: "11:30" });
  });
});

describe("an end before the start", () => {
  it("is refused, and so is an end equal to it", () => {
    expect(problemsOf(withEnd(draft(), { endTime: "09:00" })).end).toBe("The end must be after the start.");
    expect(problemsOf(withEnd(draft(), { endTime: "10:00" })).end).toBe("The end must be after the start.");
    expect(problemsOf(withEnd(draft(), { endDate: "2026-10-19" })).end).toBe("The end must be after the start.");
    expect(hasProblems(problemsOf(draft()))).toBe(false);
  });

  it("allows a later date to end earlier in the day", () => {
    expect(hasProblems(problemsOf(withEnd(draft(), { endDate: "2026-10-21", endTime: "09:00" })))).toBe(false);
  });

  it("asks for a date that is half typed", () => {
    expect(problemsOf(draft({ startDate: "" })).start).toBe("Enter a start date.");
    expect(problemsOf(draft({ endDate: "" })).end).toBe("Enter an end date.");
  });

  it("lets an all-day event last one day but not end before it starts", () => {
    const oneDay = draftOfSeed({ start: "2026-10-16", end: "2026-10-17", allDay: true }, BUCHAREST, NOW);
    expect(hasProblems(problemsOf(oneDay))).toBe(false);
    expect(problemsOf(withEnd(oneDay, { endDate: "2026-10-15" })).end).toBe("The end date can't be before the start date.");
  });

  it("keeps no eventInput back while it is wrong", () => {
    expect(eventInputOf(withEnd(draft(), { endTime: "09:00" }), 1, BUCHAREST)).toBeNull();
  });
});

describe("the All day checkbox", () => {
  it("keeps the dates, and turning it off brings the times back", () => {
    const allDay = withAllDay(draft(), true);
    expect(allDay).toMatchObject({ allDay: true, startDate: "2026-10-20", endDate: "2026-10-20", startTime: "10:00", endTime: "11:30" });
    expect(withAllDay(allDay, false)).toMatchObject({ allDay: false, startTime: "10:00", endTime: "11:30" });
  });

  it("reads an end at midnight as the day before", () => {
    const overnight = draft({ startTime: "22:00", endDate: "2026-10-21", endTime: "00:00" });
    expect(withAllDay(overnight, true).endDate).toBe("2026-10-20");
  });

  it("gives an event an hour when its stored times would end before they start", () => {
    const fromAllDay = draftOfSeed({ start: "2026-10-16", end: "2026-10-17", allDay: true }, BUCHAREST, NOW);
    const timed = withAllDay(withEnd(fromAllDay, { endTime: "09:00" }), false);
    expect(timed).toMatchObject({ startTime: "15:00", endDate: "2026-10-16", endTime: "16:00" });
  });
});

describe("time text", () => {
  it("reads 14:30, 1430 and the short forms", () => {
    expect(parseTimeText("14:30")).toBe("14:30");
    expect(parseTimeText("1430")).toBe("14:30");
    expect(parseTimeText(" 9:05 ")).toBe("09:05");
    expect(parseTimeText("905")).toBe("09:05");
    expect(parseTimeText("0905")).toBe("09:05");
    expect(parseTimeText("9.30")).toBe("09:30");
    expect(parseTimeText("14")).toBe("14:00");
    expect(parseTimeText("9")).toBe("09:00");
    expect(parseTimeText("00:00")).toBe("00:00");
    expect(parseTimeText("23:59")).toBe("23:59");
  });

  it("refuses what is no time of day", () => {
    for (const text of ["", "abc", "24:00", "12:60", "1:5", "14:3", "2:30 pm", "12345", "-1"]) {
      expect(parseTimeText(text), text).toBeNull();
    }
  });

  it("lists every 15 minutes in 24-hour labels", () => {
    const options = startTimeOptions();
    expect(options).toHaveLength(96);
    expect(options[0]).toEqual({ value: "00:00", label: "00:00" });
    expect(options[41]).toEqual({ value: "10:15", label: "10:15" });
    expect(options.at(-1)).toEqual({ value: "23:45", label: "23:45" });
  });

  it("writes durations as Google does", () => {
    expect(durationLabel(1)).toBe("1 min");
    expect(durationLabel(15)).toBe("15 mins");
    expect(durationLabel(45)).toBe("45 mins");
    expect(durationLabel(60)).toBe("1 hr");
    expect(durationLabel(75)).toBe("1.25 hrs");
    expect(durationLabel(90)).toBe("1.5 hrs");
    expect(durationLabel(120)).toBe("2 hrs");
  });

  it("shows how long in the end time's list, after the start only", () => {
    const options = endTimeOptions(draft());
    expect(options[0]).toEqual({ value: "10:15", label: "10:15 (15 mins)" });
    expect(options.find((option) => option.value === "11:00")?.label).toBe("11:00 (1 hr)");
    expect(options.find((option) => option.value === "11:30")?.label).toBe("11:30 (1.5 hrs)");
    expect(options.at(-1)?.label).toBe("23:45 (13.75 hrs)");
    expect(options.some((option) => option.value <= "10:00")).toBe(false);
  });

  it("offers every time on a later end date", () => {
    const options = endTimeOptions(draft({ endDate: "2026-10-21" }));
    expect(options).toHaveLength(96);
    expect(options[0]).toEqual({ value: "00:00", label: "00:00 (14 hrs)" });
  });
});

describe("the repeat choices", () => {
  it("are worded for the start date", () => {
    const labels = (date: string) => Object.fromEntries(repeatOptions(date, BUCHAREST).map((option) => [option.value, option.label]));
    expect(labels("2026-10-16")).toEqual({
      none: "Does not repeat",
      daily: "Daily",
      weekly: "Weekly on Friday",
      weekdays: "Every weekday (Monday to Friday)",
      monthly: "Monthly on day 16",
      yearly: "Annually on 16 October",
      custom: "Custom days…",
    });
    expect(labels("2026-02-03")).toMatchObject({ weekly: "Weekly on Tuesday", monthly: "Monthly on day 3", yearly: "Annually on 3 February" });
    expect(labels("2026-12-27")).toMatchObject({ weekly: "Weekly on Sunday", monthly: "Monthly on day 27", yearly: "Annually on 27 December" });
  });

  it("lose their day while the date is half typed", () => {
    const labels = repeatOptions("", BUCHAREST).map((option) => option.label);
    expect(labels).toEqual(["Does not repeat", "Daily", "Weekly", "Every weekday (Monday to Friday)", "Monthly", "Annually", "Custom days…"]);
  });

  it("make the shared repeat, weekly following the start's weekday", () => {
    const base = draft({ startDate: "2026-10-16" });
    const pick = (preset: Parameters<typeof choosePreset>[1], on = base) => repeatOf({ ...on, repeat: choosePreset(on.repeat, preset, on.startDate) });
    expect(pick("none")).toBeNull();
    expect(pick("daily")).toEqual({ freq: "daily", end: { type: "never" } });
    expect(pick("weekly")).toEqual({ freq: "weekly", byDay: ["FR"], end: { type: "never" } });
    expect(pick("weekly", { ...base, startDate: "2026-10-19" })).toEqual({ freq: "weekly", byDay: ["MO"], end: { type: "never" } });
    expect(pick("weekdays")).toEqual({ freq: "weekdays", end: { type: "never" } });
    expect(pick("monthly")).toEqual({ freq: "monthly", end: { type: "never" } });
    expect(pick("yearly")).toEqual({ freq: "yearly", end: { type: "never" } });
  });

  it("builds custom days in week order, and never lets the last one go", () => {
    let repeat = choosePreset(repeatDraftOf(null, "2026-10-16"), "custom", "2026-10-16");
    expect(repeat.days).toEqual(["FR"]);
    repeat = toggleDay(toggleDay(repeat, "MO"), "WE");
    expect(repeat.days).toEqual(["MO", "WE", "FR"]);
    expect(repeatOf({ repeat, startDate: "2026-10-16" })).toEqual({ freq: "weekly", byDay: ["MO", "WE", "FR"], end: { type: "never" } });
    expect(toggleDay(toggleDay(toggleDay(repeat, "MO"), "WE"), "FR").days).toEqual(["FR"]);
    // From "Every weekday", custom starts from Monday to Friday.
    const fromWeekdays = choosePreset({ ...repeat, preset: "weekdays" }, "custom", "2026-10-16");
    expect(fromWeekdays.days).toEqual(["MO", "TU", "WE", "TH", "FR"]);
  });

  it("end never, on a date or after a number of times", () => {
    const base = choosePreset(repeatDraftOf(null, "2026-10-16"), "daily", "2026-10-16");
    const until = chooseEnd(base, "until", "2026-10-16");
    expect(until.until).toBe("2026-11-16");
    expect(repeatOf({ repeat: until, startDate: "2026-10-16" })?.end).toEqual({ type: "until", date: "2026-11-16" });
    const count = { ...chooseEnd(base, "count", "2026-10-16"), count: "5" };
    expect(repeatOf({ repeat: count, startDate: "2026-10-16" })?.end).toEqual({ type: "count", count: 5 });
    // An "On" date before the start is replaced by a sensible one when chosen.
    expect(chooseEnd({ ...base, until: "2026-01-01" }, "until", "2026-10-16").until).toBe("2026-11-16");
  });

  it("refuse an end before the start and a count outside 1 to 730", () => {
    const repeating = (repeat: Partial<EventDraft["repeat"]>) => draft({ repeat: { ...draft().repeat, preset: "daily", ...repeat } });
    expect(problemsOf(repeating({ end: "until", until: "2026-10-01" })).repeat).toBe("The repeat can't end before it starts.");
    expect(problemsOf(repeating({ end: "until", until: "" })).repeat).toBe("Enter the date the repeat ends.");
    expect(problemsOf(repeating({ end: "count", count: "0" })).repeat).toContain("1 to 730");
    expect(problemsOf(repeating({ end: "count", count: "731" })).repeat).toContain("1 to 730");
    expect(problemsOf(repeating({ end: "count", count: "2.5" })).repeat).toContain("1 to 730");
    expect(problemsOf(repeating({ end: "count", count: "730" })).repeat).toBeUndefined();
    // "Does not repeat" has no end to check.
    expect(problemsOf(draft({ repeat: { ...draft().repeat, preset: "none", end: "count", count: "0" } })).repeat).toBeUndefined();
  });

  it("are read back from a repeat, a one-day weekly on the start's weekday being plain weekly", () => {
    expect(repeatDraftOf(null, "2026-10-16").preset).toBe("none");
    expect(repeatDraftOf({ freq: "weekly", byDay: ["FR"], end: { type: "never" } }, "2026-10-16").preset).toBe("weekly");
    expect(repeatDraftOf({ freq: "weekly", end: { type: "never" } }, "2026-10-16").preset).toBe("weekly");
    const custom = repeatDraftOf({ freq: "weekly", byDay: ["WE", "MO"], end: { type: "count", count: 4 } }, "2026-10-16");
    expect(custom).toMatchObject({ preset: "custom", days: ["MO", "WE"], end: "count", count: "4" });
    expect(repeatDraftOf({ freq: "weekdays", end: { type: "until", date: "2026-12-01" } }, "2026-10-16")).toMatchObject({
      preset: "weekdays",
      end: "until",
      until: "2026-12-01",
    });
    expect(repeatDraftOf({ freq: "monthly", end: { type: "never" } }, "2026-10-16").preset).toBe("monthly");
  });

  it("are summed up with describeRepeat", () => {
    const series = draftOfOccurrence(weekly({ repeat: { freq: "weekly", byDay: ["MO", "WE"], end: { type: "until", date: "2026-12-01" } } }), BUCHAREST, NOW);
    expect(repeatSummary(series, BUCHAREST)).toBe("Weekly on Monday, Wednesday, until 1 Dec 2026");
    expect(repeatSummary(draft(), BUCHAREST)).toBeNull();
    const touched = { ...draft(), repeat: choosePreset(draft().repeat, "monthly", "2026-10-20"), repeatTouched: true };
    expect(repeatSummary(touched, BUCHAREST)).toBe("Monthly on day 20");
  });

  it("compare as rules: the same one again is no change", () => {
    const friday: Repeat = { freq: "weekly", byDay: ["FR"], end: { type: "never" } };
    expect(sameRepeat(friday, { freq: "weekly", end: { type: "never" } }, "2026-10-16")).toBe(true);
    expect(sameRepeat(friday, { freq: "weekly", byDay: ["MO"], end: { type: "never" } }, "2026-10-16")).toBe(false);
    expect(sameRepeat(friday, { ...friday, end: { type: "count", count: 3 } }, "2026-10-16")).toBe(false);
    expect(sameRepeat(null, null, "2026-10-16")).toBe(true);
    expect(sameRepeat(friday, null, "2026-10-16")).toBe(false);
    expect(sameRepeat({ freq: "daily", end: { type: "count", count: 3 } }, { freq: "daily", end: { type: "count", count: 3 } }, "2026-10-16")).toBe(true);
  });
});

describe("saving a new event", () => {
  it("turns the fields into instants on the display clock", () => {
    expect(eventInputOf(draft({ title: "  Plan  ", location: " Room 4 ", notes: "" }), 2, BUCHAREST)).toEqual({
      calendarId: 2,
      title: "Plan",
      location: "Room 4",
      notes: "",
      allDay: false,
      start: "2026-10-20T07:00:00Z",
      end: "2026-10-20T08:30:00Z",
      repeat: null,
    });
    // Winter time: Bucharest is UTC+2.
    expect(wireTimesOf(draft({ startDate: "2026-11-20", endDate: "2026-11-20" }), BUCHAREST)).toEqual({
      start: "2026-11-20T08:00:00Z",
      end: "2026-11-20T09:30:00Z",
      allDay: false,
    });
  });

  it("saves an empty title as (No title)", () => {
    expect(titleOf({ title: "" })).toBe("(No title)");
    expect(titleOf({ title: "   " })).toBe("(No title)");
    expect(eventInputOf(draft(), 2, BUCHAREST)?.title).toBe("(No title)");
  });

  it("sends all-day events as dates, the end the day after the last", () => {
    const allDay = withAllDay(draft({ endDate: "2026-10-22" }), true);
    expect(eventInputOf(allDay, 2, BUCHAREST)).toMatchObject({ allDay: true, start: "2026-10-20", end: "2026-10-23" });
  });

  it("sends the repeat", () => {
    const repeating = draft({ repeat: choosePreset(draft().repeat, "weekly", "2026-10-20"), repeatTouched: true });
    expect(eventInputOf(repeating, 2, BUCHAREST)?.repeat).toEqual({ freq: "weekly", byDay: ["TU"], end: { type: "never" } });
  });
});

describe("saving an edit", () => {
  const edited = (found: Occurrence, extra: Partial<EventDraft> = {}) => ({ ...draftOfOccurrence(found, BUCHAREST, NOW), ...extra });

  it("sends nothing when nothing changed", () => {
    for (const found of [occurrence(), weekly(), occurrence({ allDay: true, start: "2026-10-16", end: "2026-10-18" })]) {
      expect(changedFields(edited(found), found, BUCHAREST), found.id).toEqual({});
    }
  });

  it("sends only the fields that changed", () => {
    const found = occurrence({ location: "Room 4", notes: "Bring the list" });
    expect(changedFields(edited(found, { title: "Daily standup" }), found, BUCHAREST)).toEqual({ title: "Daily standup" });
    expect(changedFields(edited(found, { location: " Room 5 " }), found, BUCHAREST)).toEqual({ location: "Room 5" });
    expect(changedFields(edited(found, { notes: "" }), found, BUCHAREST)).toEqual({ notes: "" });
    expect(changedFields(edited(found, { calendarId: 2 }), found, BUCHAREST)).toEqual({ calendarId: 2 });
    expect(changedFields(edited(found, { title: "" }), found, BUCHAREST)).toEqual({ title: "(No title)" });
  });

  it("doesn't mistake the hour clocks repeat for a move", () => {
    // 03:30 happens twice on 25 October in Bucharest; this is the second one.
    const found = occurrence({ start: "2026-10-25T01:30:00Z", end: "2026-10-25T02:00:00Z" });
    expect(draftOfOccurrence(found, BUCHAREST, NOW)).toMatchObject({ startTime: "03:30", endTime: "04:00" });
    expect(changedFields(edited(found, { title: "Standup, late" }), found, BUCHAREST)).toEqual({ title: "Standup, late" });
  });

  it("sends the start and end together when either moved", () => {
    const found = occurrence();
    expect(changedFields(withEnd(edited(found), { endTime: "11:00" }), found, BUCHAREST)).toEqual({
      start: "2026-10-16T07:00:00Z",
      end: "2026-10-16T08:00:00Z",
    });
    expect(changedFields(withStart(edited(found), { startTime: "11:00" }), found, BUCHAREST)).toEqual({
      start: "2026-10-16T08:00:00Z",
      end: "2026-10-16T08:30:00Z",
    });
  });

  it("sends allDay with the dates when it is switched", () => {
    const found = occurrence();
    expect(changedFields(withAllDay(edited(found), true), found, BUCHAREST)).toEqual({ allDay: true, start: "2026-10-16", end: "2026-10-17" });
    const allDay = occurrence({ allDay: true, start: "2026-10-16", end: "2026-10-17" });
    expect(changedFields(withAllDay(edited(allDay), false), allDay, BUCHAREST)).toMatchObject({ allDay: false });
  });

  it("leaves the repeat out until the picker is used, whatever the start did", () => {
    const found = weekly();
    const moved = withStart(edited(found), { startDate: "2026-10-26" });
    const changes = changedFields(moved, found, BUCHAREST);
    // 10:00 on the 26th is winter time: Bucharest has gone back to UTC+2.
    expect(changes).toEqual({ start: "2026-10-26T08:00:00Z", end: "2026-10-26T08:30:00Z" });
    expect(changes && changesRepeat(changes)).toBe(false);
    // The untouched repeat still reads as the series' own.
    expect(currentRepeat(moved)).toEqual(found.repeat);
    expect(repeatLabelDate(moved)).toBe("2026-10-23");
  });

  it("counts a repeat as changed only when it means another rule", () => {
    const found = weekly();
    const same = edited(found, { repeat: choosePreset(repeatDraftOf(found.repeat, "2026-10-23"), "weekly", "2026-10-23"), repeatTouched: true });
    const noChange = changedFields(same, found, BUCHAREST);
    expect(noChange).toEqual({});
    expect(noChange && scopeQuestion(noChange)).toEqual({ action: "edit", allowThis: true });

    const twice = edited(found, { repeat: { ...same.repeat, preset: "daily" }, repeatTouched: true });
    const changes = changedFields(twice, found, BUCHAREST);
    expect(changes).toEqual({ repeat: { freq: "daily", end: { type: "never" } } });
    expect(changes && changesRepeat(changes)).toBe(true);
  });

  it("asks for the two broader scopes only when the repeat changed", () => {
    expect(scopeQuestion({ title: "Daily standup" })).toEqual({ action: "edit", allowThis: true });
    expect(scopeQuestion({ repeat: { freq: "daily", end: { type: "never" } } })).toEqual({ action: "edit", allowThis: false });
    // Ending the repeat is a change of the rule too.
    expect(scopeQuestion({ repeat: null })).toEqual({ action: "edit", allowThis: false });
  });

  it("turns a one-off into a series, and a series into a one-off", () => {
    const found = occurrence();
    const repeating = edited(found, { repeat: choosePreset(edited(found).repeat, "daily", "2026-10-16"), repeatTouched: true });
    expect(changedFields(repeating, found, BUCHAREST)).toEqual({ repeat: { freq: "daily", end: { type: "never" } } });
    const series = weekly();
    const none = edited(series, { repeat: choosePreset(edited(series).repeat, "none", "2026-10-23"), repeatTouched: true });
    expect(changedFields(none, series, BUCHAREST)).toEqual({ repeat: null });
  });

  it("anchors a series' picker to the occurrence's original start", () => {
    // An exception moved to Saturday still belongs to the Friday series.
    const moved = weekly({ id: "e9", eventId: 9, start: "2026-10-24T07:00:00Z", end: "2026-10-24T07:30:00Z" });
    const form = draftOfOccurrence(moved, BUCHAREST, NOW);
    expect(form.startDate).toBe("2026-10-24");
    expect(form.repeat.preset).toBe("weekly");
    expect(form.origin).toEqual({ repeat: moved.repeat, anchor: "2026-10-23" });
  });

  it("shows an all-day occurrence's last day", () => {
    const form = draftOfOccurrence(occurrence({ allDay: true, start: "2026-10-16", end: "2026-10-18" }), BUCHAREST, NOW);
    expect(form).toMatchObject({ allDay: true, startDate: "2026-10-16", endDate: "2026-10-17" });
  });

  it("is not saved while the draft has problems", () => {
    const found = occurrence();
    expect(changedFields(withEnd(edited(found), { endTime: "09:00" }), found, BUCHAREST)).toBeNull();
  });
});

describe("the default calendar", () => {
  const calendars = [
    { id: 1, visible: false },
    { id: 2, visible: true },
    { id: 3, visible: true },
  ];

  it("is the last one used, else the first visible one, else the first", () => {
    expect(pickCalendar(calendars, 3)).toBe(3);
    expect(pickCalendar(calendars, null)).toBe(2);
    // The remembered calendar was deleted.
    expect(pickCalendar(calendars, 9)).toBe(2);
    expect(pickCalendar([{ id: 4, visible: false }], null)).toBe(4);
    expect(pickCalendar([], 1)).toBeNull();
  });

  describe("kept in the browser", () => {
    afterEach(() => vi.unstubAllGlobals());

    it("remembers the last calendar", () => {
      const store = new Map<string, string>();
      vi.stubGlobal("localStorage", { getItem: (key: string) => store.get(key) ?? null, setItem: (key: string, value: string) => store.set(key, value) });
      expect(readLastCalendar()).toBeNull();
      rememberCalendar(5);
      expect(readLastCalendar()).toBe(5);
      store.set("almanac.lastCalendar", "junk");
      expect(readLastCalendar()).toBeNull();
    });

    it("works without storage", () => {
      const refuse = () => {
        throw new Error("blocked");
      };
      vi.stubGlobal("localStorage", { getItem: refuse, setItem: refuse });
      expect(readLastCalendar()).toBeNull();
      expect(() => rememberCalendar(5)).not.toThrow();
    });
  });
});

describe("the server's refusals", () => {
  it("show under the field they are about", () => {
    expect(errorPlace("end: must be after the start")).toBe("when");
    expect(errorPlace("start: must be an ISO date and time")).toBe("when");
    expect(errorPlace("repeat: pick at least one day")).toBe("repeat");
    expect(errorPlace("repeat.end.count: must be 1 to 730")).toBe("repeat");
    expect(errorPlace("title: must be at most 200 characters")).toBe("general");
    expect(errorPlace("The event couldn't be saved.")).toBe("general");
  });
});
