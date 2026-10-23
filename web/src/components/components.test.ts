import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Temporal } from "temporal-polyfill";
import { describe, expect, it, vi } from "vitest";
import { Dialog } from "./Dialog";
import { MonthGrid, type MonthGridProps } from "./MonthGrid";
import { ToastView } from "./Toast";

// Base UI's dialog portal needs a DOM; this renders the dialog in place.
vi.mock("@base-ui/react/dialog", () => import("./dialog-stub"));

const october = Temporal.PlainYearMonth.from("2026-10");
const today = Temporal.PlainDate.from("2026-10-16");

function grid(props: Partial<MonthGridProps> = {}): string {
  return renderToStaticMarkup(createElement(MonthGrid, { month: october, today, onPickDay: () => undefined, size: "mini", ...props }));
}

/** The `data-date`s of the day buttons, in order. */
function days(html: string): string[] {
  return [...html.matchAll(/data-date="([^"]+)"/g)].map((match) => match[1] ?? "");
}

/** The opening tag of a day's button. */
function dayTag(html: string, key: string): string {
  return new RegExp(`<button[^>]*data-date="${key}"[^>]*>`).exec(html)?.[0] ?? "";
}

describe("MonthGrid", () => {
  it("heads the columns with Monday-first initials", () => {
    const html = grid();
    const heads = [...html.matchAll(/<th[^>]*abbr="([^"]+)"[^>]*>([^<]+)<\/th>/g)].map((m) => `${m[1]}:${m[2]}`);
    expect(heads).toEqual(["Monday:M", "Tuesday:T", "Wednesday:W", "Thursday:T", "Friday:F", "Saturday:S", "Sunday:S"]);
  });

  it("draws six weeks from the Monday before the 1st, other months' days muted", () => {
    const keys = days(grid());
    expect(keys).toHaveLength(42);
    expect(keys[0]).toBe("2026-09-28");
    expect(keys[3]).toBe("2026-10-01");
    expect(keys.at(-1)).toBe("2026-11-08");
    expect(dayTag(grid(), "2026-09-28")).toContain('data-outside="true"');
    expect(dayTag(grid(), "2026-10-01")).not.toContain("data-outside");
  });

  it("marks today with aria-current and its own state", () => {
    const tag = dayTag(grid(), "2026-10-16");
    expect(tag).toContain('aria-current="date"');
    expect(tag).toContain('data-today="true"');
    expect(tag).toContain('aria-label="Friday, 16 October 2026"');
    expect(grid().match(/aria-current="date"/g)).toHaveLength(1);
  });

  it("marks the selected date, and puts it in the tab order", () => {
    const html = grid({ selected: Temporal.PlainDate.from("2026-10-21") });
    const tag = dayTag(html, "2026-10-21");
    expect(tag).toContain('data-selected="true"');
    expect(tag).toContain('aria-pressed="true"');
    expect(tag).toContain('tabindex="0"');
    expect(dayTag(html, "2026-10-16")).toContain('tabindex="-1"');
    expect(html.match(/tabindex="0"/g)).toHaveLength(1);
  });

  it("puts today in the tab order without a selection, else the 1st", () => {
    expect(dayTag(grid(), "2026-10-16")).toContain('tabindex="0"');
    const march = grid({ month: Temporal.PlainYearMonth.from("2027-03") });
    expect(dayTag(march, "2027-03-01")).toContain('tabindex="0"');
  });

  it("dots the marked days and says so", () => {
    const html = grid({ marked: new Set(["2026-10-05", "2026-10-16"]) });
    expect(dayTag(html, "2026-10-05")).toContain('data-marked="true"');
    expect(dayTag(html, "2026-10-05")).toContain('aria-label="Monday, 5 October 2026, has events"');
    expect(dayTag(html, "2026-10-06")).not.toContain("data-marked");
    expect(html.match(/class="month-grid__dot"/g)).toHaveLength(2);
  });

  it("leaves other months' cells empty in the year view", () => {
    const html = grid({ size: "year", marked: new Set(["2026-09-30", "2026-10-30"]) });
    const keys = days(html);
    expect(keys).toHaveLength(31);
    expect(keys[0]).toBe("2026-10-01");
    expect(keys.at(-1)).toBe("2026-10-31");
    expect(html).toContain('class="month-grid month-grid--year"');
    // A dot on a day of September doesn't show in October.
    expect(html.match(/class="month-grid__dot"/g)).toHaveLength(1);
    // No selection in the year view: no pressed state at all.
    expect(html).not.toContain("aria-pressed");
  });
});

describe("Toast", () => {
  it("is an empty live region with nothing to say", () => {
    expect(renderToStaticMarkup(createElement(ToastView, { toast: null, onDismiss: () => undefined }))).toBe(
      '<div class="toaster" role="status" aria-live="polite"></div>',
    );
  });

  it("shows the message, the action and a dismiss button", () => {
    const html = renderToStaticMarkup(
      createElement(ToastView, { toast: { id: 1, message: "Event deleted", action: { label: "Undo", onAction: () => undefined } }, onDismiss: () => undefined }),
    );
    expect(html).toContain(">Event deleted</span>");
    expect(html).toContain('class="toast__action">Undo</button>');
    expect(html).toContain('aria-label="Dismiss"');
  });
});

describe("Dialog", () => {
  it("renders nothing while closed", () => {
    expect(renderToStaticMarkup(createElement(Dialog, { open: false, onClose: () => undefined, title: "Time zone", children: "x" }))).toBe("");
  });

  it("titles itself and offers a close button", () => {
    const html = renderToStaticMarkup(createElement(Dialog, { open: true, onClose: () => undefined, title: "Time zone", children: "Body", footer: "Actions" }));
    expect(html).toContain('<div role="dialog" class="dialog dialog--medium">');
    expect(html).toContain('class="dialog__title">Time zone</h2>');
    expect(html).toContain('aria-label="Close"');
    expect(html).toContain('<footer class="dialog__footer">Actions</footer>');
  });
});
