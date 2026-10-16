import type { Calendar, Occurrence } from "@almanac/shared";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { repeatDraftOf, startTimeOptions, type RepeatDraft } from "./editor-state";
import { CalendarSelect, EventForm, EventFormDialog } from "./EventForm";
import { QuickCreateForm } from "./QuickCreate";
import { RepeatPicker, type RepeatPickerProps } from "./RepeatPicker";
import { TimeField } from "./TimeField";

const BUCHAREST = "Europe/Bucharest";
const none = () => undefined;

const work: Calendar = {
  id: 1,
  name: "Work",
  color: "teal",
  visible: true,
  position: 0,
  createdAt: "2026-10-16T09:00:00Z",
  updatedAt: "2026-10-16T09:00:00Z",
};
const gym: Calendar = { ...work, id: 2, name: "Gym", color: "yellow", position: 1 };

function picker(repeat: RepeatDraft, extra: Partial<RepeatPickerProps> = {}): string {
  return renderToStaticMarkup(
    createElement(RepeatPicker, { repeat, labelDate: "2026-10-16", startDate: "2026-10-16", timeZone: BUCHAREST, onChange: none, ...extra }),
  );
}

describe("RepeatPicker", () => {
  it("words the choices for the start date and marks the chosen one", () => {
    const html = picker(repeatDraftOf(null, "2026-10-16"));
    for (const label of [
      "Does not repeat",
      "Daily",
      "Weekly on Friday",
      "Every weekday (Monday to Friday)",
      "Monthly on day 16",
      "Annually on 16 October",
      "Custom days…",
    ]) {
      expect(html).toContain(`>${label}</option>`);
    }
    expect(html).toContain('<option value="none" selected="">Does not repeat</option>');
    // Nothing about how it ends until it repeats.
    expect(html).not.toContain("Repeat ends");
  });

  it("follows another start date", () => {
    const html = picker(repeatDraftOf(null, "2026-02-03"), { labelDate: "2026-02-03", startDate: "2026-02-03" });
    expect(html).toContain(">Weekly on Tuesday</option>");
    expect(html).toContain(">Monthly on day 3</option>");
    expect(html).toContain(">Annually on 3 February</option>");
  });

  it("shows how a repeat ends", () => {
    const daily = { ...repeatDraftOf(null, "2026-10-16"), preset: "daily" as const };
    const never = picker(daily);
    expect(never).toContain('aria-label="Repeat ends"');
    expect(never).toContain('<option value="never" selected="">Never</option>');
    expect(never).not.toContain('aria-label="Repeat ends on"');
    expect(never).not.toContain("editor-hint");

    const until = picker({ ...daily, end: "until", until: "2026-12-01" }, { summary: "Daily, until 1 Dec 2026" });
    expect(until).toContain('<input type="date" class="editor-input editor-date" aria-label="Repeat ends on"');
    expect(until).toContain('value="2026-12-01"');
    expect(until).toContain("Daily, until 1 Dec 2026");

    const count = picker({ ...daily, end: "count", count: "5" });
    expect(count).toContain('aria-label="Number of occurrences"');
    expect(count).toContain('value="5"');
    expect(count).toContain("occurrences");
  });

  it("toggles the days of Custom days… and says what they come to", () => {
    const custom: RepeatDraft = { ...repeatDraftOf(null, "2026-10-16"), preset: "custom", days: ["MO", "WE"] };
    const html = picker(custom, { summary: "Weekly on Monday, Wednesday" });
    expect(html.match(/aria-pressed="true"/g)).toHaveLength(2);
    expect(html.match(/aria-pressed="false"/g)).toHaveLength(5);
    expect(html).toContain('aria-label="Monday"');
    expect(html).toContain('aria-pressed="true" aria-label="Monday" title="Monday">M<');
    expect(html).toContain("Weekly on Monday, Wednesday");
  });

  it("says what is wrong with the repeat", () => {
    const daily = { ...repeatDraftOf(null, "2026-10-16"), preset: "daily" as const, end: "count" as const, count: "0" };
    const html = picker(daily, { error: "Use a number of occurrences from 1 to 730." });
    expect(html).toContain('role="alert"');
    expect(html).toContain("Use a number of occurrences from 1 to 730.");
    expect(html).toContain('aria-invalid="true"');
  });
});

describe("TimeField", () => {
  const field = (value: string) =>
    renderToStaticMarkup(createElement(TimeField, { value, options: startTimeOptions, onChange: none, label: "Start time" }));

  it("shows the time as 24-hour text in a closed combobox", () => {
    const html = field("14:30");
    expect(html).toContain('value="14:30"');
    expect(html).toContain('role="combobox"');
    expect(html).toContain('aria-label="Start time"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).not.toContain("<ul");
  });
});

describe("CalendarSelect", () => {
  it("lists the calendars with the chosen one's colour", () => {
    const html = renderToStaticMarkup(createElement(CalendarSelect, { calendars: [work, gym], value: 2, onChange: none }));
    expect(html).toContain('<option value="1">Work</option>');
    expect(html).toContain('<option value="2" selected="">Gym</option>');
    expect(html).toContain("--calendar-color:#F6BF26");
  });

  it("waits for the calendars to load", () => {
    const html = renderToStaticMarkup(createElement(CalendarSelect, { calendars: [], value: null, onChange: none }));
    expect(html).toContain("Loading…");
    expect(html).toContain("disabled");
  });
});

describe("QuickCreateForm", () => {
  const html = (extra: { start?: string; end?: string; allDay?: boolean } = {}) =>
    renderToStaticMarkup(
      createElement(QuickCreateForm, {
        init: { start: "2026-10-16T07:00:00Z", end: "2026-10-16T08:00:00Z", allDay: false, // QuickCreateForm doesn't use the anchor; the popover around it does.
        anchor: {} as DOMRect, ...extra },
        onClose: none,
        onSaved: none,
        onMoreOptions: none,
      }),
    );

  it("has a title, the time as text, the calendar, Save and More options", () => {
    const page = html();
    expect(page).toContain('aria-label="Title"');
    expect(page).toContain('placeholder="Add title"');
    expect(page).toContain("Friday, 16 October · 10:00 – 11:00");
    expect(page).toContain('aria-label="Calendar"');
    expect(page).toContain("More options");
    expect(page).toContain(">Save</button>");
    expect(page.match(/"quick-create__lead"><svg width="20"/g)).toHaveLength(2);
  });

  it("says All day for an all-day selection", () => {
    expect(html({ start: "2026-10-16", end: "2026-10-17", allDay: true })).toContain("Friday, 16 October · All day");
  });
});

describe("EventForm", () => {
  const form = (props: { seed?: Parameters<typeof EventForm>[0]["seed"]; occurrence?: Occurrence }) =>
    renderToStaticMarkup(createElement(EventFormDialog, { onClose: none, timeZone: BUCHAREST, ...props }));

  it("waits for the display time zone before drafting any time", () => {
    // Nothing has loaded the settings here: their status is "loading".
    expect(renderToStaticMarkup(createElement(EventForm, { onClose: none, seed: { start: "2026-10-20T07:00:00Z" } }))).toBe("");
  });

  it("drafts the times in the display time zone it is given", () => {
    const seed = { start: "2026-10-20T07:00:00Z", end: "2026-10-20T08:00:00Z" };
    const london = renderToStaticMarkup(createElement(EventFormDialog, { onClose: none, timeZone: "Europe/London", seed }));
    expect(london).toMatch(/aria-label="Start time"[^>]*value="08:00"/);
    expect(form({ seed })).toMatch(/aria-label="Start time"[^>]*value="10:00"/);
  });

  it("opens a new event with every field and no Delete", () => {
    const html = form({ seed: { start: "2026-10-20T07:00:00Z", end: "2026-10-20T08:30:00Z", title: "Plan" } });
    expect(html).toContain("New event");
    expect(html).toContain('value="Plan"');
    expect(html).toContain('aria-label="Start date"');
    expect(html).toContain('value="2026-10-20"');
    expect(html).toContain('aria-label="Start time"');
    expect(html).toContain('value="10:00"');
    expect(html).toContain('aria-label="End time"');
    expect(html).toContain('value="11:30"');
    expect(html).toContain('aria-label="End date"');
    expect(html).toContain("All day");
    expect(html).toContain('<option value="none" selected="">Does not repeat</option>');
    expect(html).toContain('aria-label="Location"');
    expect(html).toContain('aria-label="Notes"');
    expect(html).toContain(">Cancel</button>");
    expect(html).toContain(">Save</button>");
    expect(html).not.toContain(">Delete</button>");
    // The rows' icons at 20 px, the size editor.css lays the rows out for.
    expect(html.match(/"editor-row__lead"><svg width="20"/g)).toHaveLength(5);
  });

  it("hides the times of an all-day event", () => {
    const html = form({ seed: { start: "2026-10-16", end: "2026-10-18", allDay: true } });
    expect(html).not.toContain('aria-label="Start time"');
    expect(html).not.toContain('aria-label="End time"');
    expect(html).toContain('value="2026-10-16"');
    expect(html).toContain('value="2026-10-17"');
    expect(html).toContain('checked=""');
  });

  it("starts from a whole hour when it is opened with nothing", () => {
    const html = form({});
    expect(html).toMatch(/aria-label="Start date"[^>]*value="\d{4}-\d{2}-\d{2}"/);
    expect(html).toMatch(/aria-label="Start time"[^>]*value="\d\d:00"/);
    expect(html).toMatch(/aria-label="End time"[^>]*value="\d\d:00"/);
  });

  it("opens an occurrence for editing with Delete and its repeat", () => {
    const found: Occurrence = {
      id: "s7:2026-10-23T07:00:00Z",
      eventId: 7,
      seriesId: 7,
      originalStart: "2026-10-23T07:00:00Z",
      calendarId: 1,
      title: "Standup",
      location: "Room 4",
      notes: "Bring the list",
      allDay: false,
      start: "2026-10-23T07:00:00Z",
      end: "2026-10-23T07:30:00Z",
      repeat: { freq: "weekly", byDay: ["MO", "FR"], end: { type: "count", count: 6 } },
    };
    const html = form({ occurrence: found });
    expect(html).toContain("Edit event");
    expect(html).toContain('value="Standup"');
    expect(html).toContain('value="2026-10-23"');
    expect(html).toContain('value="10:00"');
    expect(html).toContain('value="10:30"');
    expect(html).toContain('value="Room 4"');
    expect(html).toContain("Bring the list");
    expect(html).toContain('<option value="custom" selected="">Custom days…</option>');
    expect(html).toContain("Weekly on Monday, Friday, 6 times");
    expect(html).toContain(">Delete</button>");
  });
});
