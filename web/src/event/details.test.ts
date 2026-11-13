import type { Calendar, Occurrence } from "@almanac/shared";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { EventDetails, type EventDetailsProps } from "./DetailsPopover";
import { whenLines, whenText } from "./occurrence-text";
import { SCOPE_LABELS, ScopeDialog, answerOnce, scopeChoices, scopeTitle } from "./scope";

// Base UI's dialog portal needs a DOM; this renders the dialog in place.
vi.mock("@base-ui/react/dialog", () => import("../components/ui/dialog-stub"));

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
  reminderMinutes: null,
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
    expect(whenText({ allDay: true, start: "2026-10-16", end: "2026-10-17" }, BUCHAREST)).toBe(
      "Friday, 16 October · All day",
    );
    expect(whenText({ allDay: true, start: "2026-10-16", end: "2026-10-19" }, BUCHAREST)).toBe(
      "Friday, 16 October – Sunday, 18 October",
    );
  });
});

describe("whenLines", () => {
  it("puts the date first and the time on its own line, with no middle dot", () => {
    expect(whenLines(standup, BUCHAREST)).toEqual({ date: "Friday, 16 October", time: "10:00 – 11:00" });
    expect(whenLines({ allDay: true, start: "2026-10-16", end: "2026-10-17" }, BUCHAREST)).toEqual({
      date: "Friday, 16 October",
      time: "All day",
    });
  });

  it("keeps one line for an event that spans days", () => {
    const spanning = { allDay: true, start: "2026-10-16", end: "2026-10-19" };
    expect(whenLines(spanning, BUCHAREST)).toEqual({
      date: "Friday, 16 October – Sunday, 18 October",
      time: null,
    });
  });
});

describe("EventDetails", () => {
  it("shows the reminder in words under its label, and nothing when there is none", () => {
    expect(details()).not.toContain("Reminder");
    expect(details({ occurrence: { ...standup, reminderMinutes: 10 } })).toMatch(
      />Reminder<\/p><p[^>]*>10 minutes before<\/p>/,
    );
    expect(details({ occurrence: { ...standup, reminderMinutes: 0 } })).toContain(">at the start</p>");
    const nameDay = { ...standup, allDay: true, start: "2026-10-16", end: "2026-10-17", reminderMinutes: 900 };
    expect(details({ occurrence: nameDay })).toContain(">the day before at 09:00</p>");
  });

  it("shows the title, the time, the calendar and the actions", () => {
    const html = details();
    expect(html).toMatch(/<h2 id="title"[^>]*>Standup<\/h2>/);
    expect(html).toMatch(/>Friday, 16 October<\/p><p[^>]*>10:00 – 11:00<\/p>/);
    expect(html).not.toContain("·");
    expect(html).toContain('style="--calendar-color:var(--color-cal-teal)"');
    expect(html).toMatch(/<p[^>]*>Work<\/p>/);
    for (const label of ["Edit event", "Delete event", "Close"]) expect(html).toContain(`aria-label="${label}"`);
    // Delete and Edit are labelled buttons, Delete the danger one.
    expect(html).toMatch(/aria-label="Delete event"[^>]*>(<svg[^>]*>.*?<\/svg>)?Delete<\/button>/);
    expect(html).toMatch(/aria-label="Edit event"[^>]*>(<svg[^>]*>.*?<\/svg>)?Edit<\/button>/);
    expect(html).toContain("text-danger");
    // The close button and the calendar row's icons are 20 px, the buttons' 18.
    expect(html.match(/<svg width="(\d+)"/g)).toEqual([
      '<svg width="20"',
      '<svg width="20"',
      '<svg width="18"',
      '<svg width="18"',
    ]);
    expect(html).not.toContain("Weekly");
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
    expect(details({ occurrence })).toMatch(/<p[^>]*>Weekly on Monday, Wednesday, until 1 Dec 2026<\/p>/);
  });

  it("makes links in the location and notes clickable and keeps the notes' lines", () => {
    const html = details({
      occurrence: {
        ...standup,
        location: "https://meet.example.com/abc",
        notes: "Agenda:\n<b>https://example.com/doc</b>",
      },
    });
    expect(html).toContain(
      '><a href="https://meet.example.com/abc" target="_blank" rel="noopener noreferrer">https://meet.example.com/abc</a></p>',
    );
    expect(html).toContain(
      '>Agenda:\n&lt;b&gt;<a href="https://example.com/doc" target="_blank" rel="noopener noreferrer">https://example.com/doc</a>&lt;/b&gt;</p>',
    );
  });

  it("writes an empty title as Google does, and leaves out a calendar not yet loaded", () => {
    const html = details({ occurrence: { ...standup, title: "" }, calendar: null });
    expect(html).toContain("(No title)");
    expect(html).not.toContain("--calendar-color:");
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
    const html = renderToStaticMarkup(
      createElement(ScopeDialog, { action: "edit", allowThis: true, onDone: () => undefined }),
    );
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
    const html = renderToStaticMarkup(
      createElement(ScopeDialog, { action: "delete", allowThis: false, onDone: () => undefined }),
    );
    expect(html).not.toContain("This event<");
    expect(html).toMatch(/checked="" value="following"/);
    expect(html).toContain("Delete recurring event");
  });

  it("takes the dialog away before the asker hears the answer, after the click", async () => {
    const steps: string[] = [];
    const answer = answerOnce<string | null>(
      () => steps.push("close"),
      (scope) => steps.push(`answer ${scope}`),
    );
    answer(null);
    answer("all");
    steps.push("click over");
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    expect(steps).toEqual(["click over", "close", "answer null"]);
  });
});
