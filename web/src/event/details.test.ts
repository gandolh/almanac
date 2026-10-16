import type { Calendar, Occurrence } from "@almanac/shared";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { EventDetails, whenText, type EventDetailsProps } from "./DetailsPopover";
import { SCOPE_LABELS, ScopeDialog, scopeChoices, scopeTitle } from "./scope";

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

const standup: Occurrence = {
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
  end: "2026-10-16T08:00:00Z",
  repeat: null,
};

function details(props: Partial<EventDetailsProps> = {}): string {
  const none = () => undefined;
  return renderToStaticMarkup(
    createElement(EventDetails, {
      occurrence: standup,
      calendar: work,
      timeZone: BUCHAREST,
      titleId: "title",
      onEdit: none,
      onDelete: none,
      onClose: none,
      ...props,
    }),
  );
}

describe("whenText", () => {
  it("writes a timed occurrence's day and times in the display time zone", () => {
    expect(whenText(standup, BUCHAREST)).toBe("Friday, 16 October · 10:00 – 11:00");
    expect(whenText(standup, "UTC")).toBe("Friday, 16 October · 07:00 – 08:00");
    // Ending at the next midnight is still that day.
    expect(whenText({ allDay: false, start: "2026-10-16T19:00:00Z", end: "2026-10-16T21:00:00Z" }, BUCHAREST)).toBe(
      "Friday, 16 October · 22:00 – 00:00",
    );
  });

  it("writes both days when a timed occurrence runs past midnight", () => {
    expect(whenText({ allDay: false, start: "2026-10-16T19:00:00Z", end: "2026-10-16T23:00:00Z" }, BUCHAREST)).toBe(
      "Friday, 16 October, 22:00 – Saturday, 17 October, 02:00",
    );
  });

  it("writes all-day occurrences as dates, the end exclusive", () => {
    expect(whenText({ allDay: true, start: "2026-10-16", end: "2026-10-17" }, BUCHAREST)).toBe("Friday, 16 October · All day");
    expect(whenText({ allDay: true, start: "2026-10-16", end: "2026-10-19" }, BUCHAREST)).toBe(
      "Friday, 16 October – Sunday, 18 October",
    );
  });
});

describe("EventDetails", () => {
  it("shows the title, the time, the calendar and the actions", () => {
    const html = details();
    expect(html).toContain('<h2 id="title" class="details__title">Standup</h2>');
    expect(html).toContain("Friday, 16 October · 10:00 – 11:00");
    expect(html).toContain('style="--calendar-color:#009688"');
    expect(html).toContain('<p class="details__text">Work</p>');
    for (const label of ["Edit event", "Delete event", "Close"]) expect(html).toContain(`aria-label="${label}"`);
    expect(html).not.toContain("details__repeat");
    expect(html).not.toContain("Location");
  });

  it("says how a series repeats, from its original start", () => {
    const occurrence: Occurrence = {
      ...standup,
      id: "e9",
      eventId: 9,
      seriesId: 7,
      originalStart: "2026-10-19T07:00:00Z",
      start: "2026-10-20T07:00:00Z",
      end: "2026-10-20T08:00:00Z",
      repeat: { freq: "weekly", byDay: ["MO", "WE"], end: { type: "until", date: "2026-12-01" } },
    };
    expect(details({ occurrence })).toContain('<p class="details__repeat">Weekly on Monday, Wednesday, until 1 Dec 2026</p>');
  });

  it("makes links in the location and notes clickable and keeps the notes' lines", () => {
    const html = details({
      occurrence: { ...standup, location: "https://meet.example.com/abc", notes: "Agenda:\n<b>https://example.com/doc</b>" },
    });
    expect(html).toContain(
      '<p class="details__text"><a href="https://meet.example.com/abc" target="_blank" rel="noopener noreferrer">https://meet.example.com/abc</a></p>',
    );
    expect(html).toContain(
      '<p class="details__text details__notes">Agenda:\n&lt;b&gt;<a href="https://example.com/doc" target="_blank" rel="noopener noreferrer">https://example.com/doc</a>&lt;/b&gt;</p>',
    );
  });

  it("writes an empty title as Google does, and leaves out a calendar not yet loaded", () => {
    const html = details({ occurrence: { ...standup, title: "" }, calendar: null });
    expect(html).toContain("(No title)");
    expect(html).not.toContain("--calendar-color");
    expect(html).not.toContain(">Calendar<");
  });
});

describe("the edit scope", () => {
  it("offers the three scopes, or only the two broader ones", () => {
    expect(scopeChoices(true)).toEqual(["this", "following", "all"]);
    expect(scopeChoices(false)).toEqual(["following", "all"]);
    expect(scopeTitle("edit")).toBe("Edit recurring event");
    expect(scopeTitle("delete")).toBe("Delete recurring event");
  });

  it("draws radio buttons with the first one chosen, and OK and Cancel", () => {
    const html = renderToStaticMarkup(createElement(ScopeDialog, { action: "edit", allowThis: true, onDone: () => undefined }));
    const labels = [...html.matchAll(/<span>([^<]+)<\/span><\/label>/g)].map((match) => match[1]);
    expect(labels).toEqual([SCOPE_LABELS.this, SCOPE_LABELS.following, SCOPE_LABELS.all]);
    expect(labels).toEqual(["This event", "This and following events", "All events"]);
    expect(html.match(/type="radio"[^>]*checked=""/g)).toHaveLength(1);
    expect(html).toMatch(/checked="" value="this"/);
    expect(html).toContain("Edit recurring event");
    expect(html).toContain(">Cancel</button>");
    expect(html).toContain(">OK</button>");
  });

  it("chooses 'This and following events' first when 'This event' can't apply", () => {
    const html = renderToStaticMarkup(createElement(ScopeDialog, { action: "delete", allowThis: false, onDone: () => undefined }));
    expect(html).not.toContain("This event<");
    expect(html).toMatch(/checked="" value="following"/);
    expect(html).toContain("Delete recurring event");
  });
});
