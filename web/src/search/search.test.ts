import { SEARCH_LIMIT, SEARCH_QUERY_MAX, type Calendar, type Occurrence } from "@almanac/shared";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Temporal } from "../dates";
import { SearchField } from "./SearchBox";
import { ResultsView, dateLabel, groupResults, timeText, type ResultsViewProps } from "./SearchResults";
import { normalizeQuery, searchPath } from "./search-api";

const BUCHAREST = "Europe/Bucharest";

const work: Calendar = {
  id: 1,
  name: "Work",
  color: "teal",
  visible: true,
  position: 0,
  createdAt: "2026-10-16T09:00:00Z",
  updatedAt: "2026-10-16T09:00:00Z",
};

function occurrence(id: string, extra: Partial<Occurrence> = {}): Occurrence {
  return {
    id,
    eventId: 1,
    seriesId: null,
    originalStart: null,
    calendarId: 1,
    title: "Ședință",
    location: "",
    notes: "",
    allDay: false,
    start: "2026-10-16T07:00:00Z",
    end: "2026-10-16T08:00:00Z",
    repeat: null,
    ...extra,
  };
}

function view(props: Partial<ResultsViewProps> = {}): string {
  return renderToStaticMarkup(
    createElement(ResultsView, { query: "sedinta", results: [], timeZone: BUCHAREST, calendars: [work], ...props }),
  );
}

describe("normalizeQuery and searchPath", () => {
  it("trims, and cuts a long deep-linked query to what the server takes", () => {
    expect(normalizeQuery("  sedinta ")).toBe("sedinta");
    expect(normalizeQuery("   ")).toBe("");
    expect(normalizeQuery(`${"a".repeat(SEARCH_QUERY_MAX)} b`)).toBe("a".repeat(SEARCH_QUERY_MAX));
    expect(normalizeQuery(`${"a".repeat(SEARCH_QUERY_MAX - 1)} b`)).toBe("a".repeat(SEARCH_QUERY_MAX - 1));
  });

  it("escapes the query into the address", () => {
    expect(searchPath("șe & ce?")).toBe("/api/search?q=%C8%99e+%26+ce%3F");
  });
});

describe("groupResults", () => {
  it("groups by the date each starts on, the dates in order", () => {
    const later = occurrence("e3", { start: "2026-10-20T10:00:00Z", end: "2026-10-20T11:00:00Z" });
    const first = occurrence("e1");
    const second = occurrence("e2", { start: "2026-10-16T12:00:00Z", end: "2026-10-16T13:00:00Z" });
    const days = groupResults([later, second, first], BUCHAREST);
    expect(days.map((day) => day.key)).toEqual(["2026-10-16", "2026-10-20"]);
    expect(days.map((day) => day.items.map((item) => item.id))).toEqual([["e1", "e2"], ["e3"]]);
    expect(days[0]?.date.equals(Temporal.PlainDate.from("2026-10-16"))).toBe(true);
  });

  it("puts all-day events first on their date", () => {
    const timed = occurrence("e1", { start: "2026-10-16T05:00:00Z", end: "2026-10-16T06:00:00Z" });
    const allDay = occurrence("e2", { allDay: true, start: "2026-10-16", end: "2026-10-17" });
    const [day] = groupResults([timed, allDay], BUCHAREST);
    expect(day?.items.map((item) => item.id)).toEqual(["e2", "e1"]);
  });

  it("reads the date in the display time zone", () => {
    // 22:30 UTC on the 16th is 01:30 on the 17th in Bucharest (UTC+3).
    const night = occurrence("e1", { start: "2026-10-16T22:30:00Z", end: "2026-10-16T23:30:00Z" });
    expect(groupResults([night], BUCHAREST).map((day) => day.key)).toEqual(["2026-10-17"]);
    expect(groupResults([night], "UTC").map((day) => day.key)).toEqual(["2026-10-16"]);
  });

  it("is empty for no results, and leaves its input alone", () => {
    expect(groupResults([], BUCHAREST)).toEqual([]);
    const input = [occurrence("e2", { start: "2026-10-18T07:00:00Z" }), occurrence("e1")];
    groupResults(input, BUCHAREST);
    expect(input.map((item) => item.id)).toEqual(["e2", "e1"]);
  });
});

describe("dateLabel and timeText", () => {
  it("writes a group's date as Google does, before the stylesheet capitals it", () => {
    expect(dateLabel(Temporal.PlainDate.from("2026-10-16"))).toBe("16 Oct 2026, Fri");
    expect(dateLabel(Temporal.PlainDate.from("2027-01-03"))).toBe("3 Jan 2027, Sun");
  });

  it("says All day, or the times in the display time zone", () => {
    expect(timeText(occurrence("e1", { allDay: true, start: "2026-10-16", end: "2026-10-17" }), BUCHAREST)).toBe("All day");
    expect(timeText(occurrence("e1"), BUCHAREST)).toBe("10:00 – 11:00");
    expect(timeText(occurrence("e1"), "UTC")).toBe("07:00 – 08:00");
    expect(timeText(occurrence("e1", { start: "2026-10-16T06:05:00Z", end: "2026-10-16T06:30:00Z" }), "UTC")).toBe("06:05 – 06:30");
  });
});

describe("ResultsView", () => {
  it("says what was not found, in the words typed", () => {
    const html = view({ query: "sedinta" });
    // The markup spells the quotes as entities; the page shows No results for "sedinta".
    expect(html).toContain("No results for &quot;sedinta&quot;");
    expect(html).toContain('role="status"');
    expect(html).not.toContain("search-day");
  });

  it("doesn't let a query write markup", () => {
    expect(view({ query: "<b>x</b>" })).toContain("No results for &quot;&lt;b&gt;x&lt;/b&gt;&quot;");
  });

  it("lists each date with its events: dot, time, title, location, and a link to the day", () => {
    const html = view({
      results: [
        occurrence("e1", { location: "Sala 2" }),
        occurrence("e2", { title: "Zi liberă", allDay: true, start: "2026-10-20", end: "2026-10-21" }),
      ],
    });
    expect(html).toContain('<time dateTime="2026-10-16">16 Oct 2026, Fri</time>');
    expect(html).toContain('<time dateTime="2026-10-20">20 Oct 2026, Tue</time>');
    expect(html).toContain("10:00 – 11:00");
    expect(html).toContain("All day");
    expect(html).toContain("Ședință");
    expect(html).toContain("Sala 2");
    expect(html).toMatch(/href="[^"]*\/day\/2026\/10\/16"/);
    expect(html).toMatch(/href="[^"]*\/day\/2026\/10\/20"/);
    // Teal, from its calendar.
    expect(html).toContain("--calendar-color:#009688");
    expect(html.indexOf("16 Oct 2026")).toBeLessThan(html.indexOf("20 Oct 2026"));
  });

  it("shows a repeating event's repeat under its title, and only then", () => {
    const series = occurrence("s7:2026-10-16T07:00:00Z", {
      eventId: 7,
      seriesId: 7,
      originalStart: "2026-10-16T07:00:00Z",
      repeat: { freq: "weekly", byDay: ["FR"], end: { type: "never" } },
    });
    expect(view({ results: [series] })).toContain("Weekly on Friday");
    expect(view({ results: [occurrence("e1")] })).not.toContain("search-event__repeat");
  });

  it("gives an event with no title the views' name for it, and leaves out an empty location", () => {
    const html = view({ results: [occurrence("e1", { title: "" })] });
    expect(html).toContain("(No title)");
    expect(html).not.toContain("search-event__location");
  });

  it("gives a result whose calendar isn't known yet a neutral dot", () => {
    const html = view({ results: [occurrence("e1", { calendarId: 99 })], calendars: [work] });
    expect(html).toContain("search-event__dot");
    expect(html).not.toContain("--calendar-color");
  });

  it("says when the list was cut short", () => {
    const full = Array.from({ length: SEARCH_LIMIT }, (_, index) => occurrence(`e${index + 1}`, { eventId: index + 1 }));
    expect(view({ results: full })).toContain(`Showing the first ${SEARCH_LIMIT} results`);
    expect(view({ results: full.slice(1) })).not.toContain("Showing the first");
  });
});

describe("SearchField", () => {
  function field(value: string): string {
    const none = () => undefined;
    return renderToStaticMarkup(
      createElement(SearchField, { value, onChange: none, onSubmit: none, onClose: none, onClear: none }),
    );
  }

  it("is a search form with a back arrow and a field that takes what the server takes", () => {
    const html = field("");
    expect(html).toContain('role="search"');
    expect(html).toContain('aria-label="Close search"');
    expect(html).toContain('type="search"');
    expect(html).toContain(`maxLength="${SEARCH_QUERY_MAX}"`);
    expect(html).toContain('enterKeyHint="search"');
  });

  it("offers to clear only once something is typed", () => {
    expect(field("")).not.toContain("Clear search");
    expect(field("sedinta")).toContain("Clear search");
    expect(field("sedinta")).toContain('value="sedinta"');
  });
});
