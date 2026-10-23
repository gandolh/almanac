import type { Calendar } from "@almanac/shared";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { CalendarRow, checkCalendarName, DeleteCalendarDialog, LAST_CALENDAR_REASON, RenameField, rowMenuSections, type CalendarRowProps } from "./CalendarRow";
import { ColorPicker } from "./ColorPicker";

// Base UI's dialog portal needs a DOM; this renders the dialog in place.
vi.mock("@base-ui/react/dialog", () => import("../components/dialog-stub"));

const work: Calendar = {
  id: 2,
  name: "Work",
  color: "green",
  visible: true,
  position: 1,
  createdAt: "2026-10-16T07:00:00Z",
  updatedAt: "2026-10-16T07:00:00Z",
};

function row(props: Partial<CalendarRowProps> = {}): string {
  return renderToStaticMarkup(
    createElement(CalendarRow, {
      calendar: work,
      isOnly: false,
      onVisibleChange: () => undefined,
      onRename: () => undefined,
      onRecolor: () => undefined,
      onDelete: async () => undefined,
      ...props,
    }),
  );
}

/** The opening tag of the first element whose tag contains `marker`. */
function tagWith(html: string, element: string, marker: string): string {
  return [...html.matchAll(new RegExp(`<${element}[^>]*>`, "g"))].map((match) => match[0]).find((tag) => tag.includes(marker)) ?? "";
}

describe("CalendarRow", () => {
  it("draws a visible calendar's checkbox checked, in its colour, with its name", () => {
    const html = row();
    expect(tagWith(html, "input", "calendar-row__input")).toContain('type="checkbox"');
    expect(tagWith(html, "input", "calendar-row__input")).toContain('checked=""');
    expect(html).toContain("--calendar-color:#33B679");
    expect(html).toContain(">Work</span>");
  });

  it("leaves a hidden calendar's checkbox unchecked", () => {
    const html = row({ calendar: { ...work, visible: false } });
    expect(tagWith(html, "input", "calendar-row__input")).not.toContain("checked");
    expect(html).toContain(">Work</span>");
  });

  it("has a ⋮ button that opens a menu, named for the calendar", () => {
    const trigger = tagWith(row(), "button", "calendar-row__more");
    expect(trigger).toContain('aria-haspopup="menu"');
    expect(trigger).toContain('aria-label="Options for Work"');
    expect(trigger).toContain('aria-expanded="false"');
  });
});

describe("the ⋮ menu", () => {
  const actions = () => ({ rename: vi.fn(), chooseColor: vi.fn(), remove: vi.fn() });

  it("offers Rename, Colour… (naming the current colour) and Delete", () => {
    const sections = rowMenuSections(work, false, actions());
    const items = sections.flatMap((section) => section.items);
    expect(items.map((item) => item.label)).toEqual(["Rename", "Colour…", "Delete"]);
    expect(items[1]?.detail).toBe("Green");
  });

  it("disables Delete for the user's only calendar and says why", () => {
    const [only] = rowMenuSections(work, true, actions()).flatMap((section) => section.items).slice(-1);
    expect(only?.label).toBe("Delete");
    expect(only?.disabled).toBe(true);
    expect(only?.detail).toBe("Only calendar");
  });

  it("leaves Delete enabled when there are other calendars", () => {
    const [other] = rowMenuSections(work, false, actions()).flatMap((section) => section.items).slice(-1);
    expect(other?.disabled).toBeFalsy();
    expect(other?.detail).toBeUndefined();
  });

  it("runs the action each item names", () => {
    const on = actions();
    const [rename, color, remove] = rowMenuSections(work, false, on).flatMap((section) => section.items);
    rename?.onSelect();
    color?.onSelect();
    remove?.onSelect();
    expect(on.rename).toHaveBeenCalledOnce();
    expect(on.chooseColor).toHaveBeenCalledOnce();
    expect(on.remove).toHaveBeenCalledOnce();
  });
});

describe("DeleteCalendarDialog", () => {
  const dialog = (isOnly: boolean) => renderToStaticMarkup(createElement(DeleteCalendarDialog, { calendar: work, isOnly, onConfirm: () => undefined, onClose: () => undefined }));
  const deleteButton = (html: string) => /<button[^>]*>Delete<\/button>/.exec(html)?.[0] ?? "";

  it("asks about the calendar by name and says its events go too", () => {
    expect(dialog(false)).toContain("Delete &quot;Work&quot;? Its events will be deleted too.");
  });

  it("leaves Delete enabled for a calendar that isn't the last", () => {
    const button = deleteButton(dialog(false));
    expect(button).not.toBe("");
    expect(button).not.toContain("disabled");
    expect(button).not.toContain("title=");
  });

  it("disables Delete for the last calendar, with the reason in its title", () => {
    const html = dialog(true);
    const button = deleteButton(html);
    expect(button).toContain('disabled=""');
    expect(button).toContain("title=");
    expect(button).toContain("can&#x27;t delete your only calendar");
    expect(LAST_CALENDAR_REASON).toContain("only calendar");
  });
});

describe("RenameField", () => {
  it("starts on the name, limited to 60 characters", () => {
    const html = renderToStaticMarkup(createElement(RenameField, { name: "Work", onCommit: () => undefined, onCancel: () => undefined }));
    expect(html).toContain('value="Work"');
    expect(html).toMatch(/maxlength="60"/i);
    expect(html).toContain('aria-label="Calendar name"');
    expect(html).not.toContain("aria-invalid");
  });
});

describe("checkCalendarName", () => {
  it("accepts 1 to 60 characters and trims them", () => {
    expect(checkCalendarName("Gym")).toEqual({ ok: true, name: "Gym" });
    expect(checkCalendarName("  Gym  ")).toEqual({ ok: true, name: "Gym" });
    expect(checkCalendarName("x".repeat(60))).toEqual({ ok: true, name: "x".repeat(60) });
  });

  it("refuses an empty or blank name, and one over 60", () => {
    expect(checkCalendarName("")).toEqual({ ok: false, error: "Give the calendar a name." });
    expect(checkCalendarName("   ")).toEqual({ ok: false, error: "Give the calendar a name." });
    expect(checkCalendarName("x".repeat(61))).toEqual({ ok: false, error: "Use 60 characters or fewer." });
  });
});

describe("ColorPicker", () => {
  const html = renderToStaticMarkup(createElement(ColorPicker, { value: "green", onChange: () => undefined }));
  const swatches = [...html.matchAll(/<button[^>]*role="radio"[^>]*>/g)].map((match) => match[0]);

  it("shows the whole palette in order, as a radio group", () => {
    expect(html).toContain('role="radiogroup"');
    expect(swatches.map((tag) => /aria-label="([^"]+)"/.exec(tag)?.[1])).toEqual([
      "Blue",
      "Teal",
      "Green",
      "Olive",
      "Yellow",
      "Orange",
      "Red",
      "Pink",
      "Purple",
      "Graphite",
    ]);
    expect(swatches[0]).toContain("--swatch:#4285F4");
  });

  it("ticks the current colour and puts only it in the Tab order", () => {
    const chosen = swatches.filter((tag) => tag.includes('aria-checked="true"'));
    expect(chosen).toHaveLength(1);
    expect(chosen[0]).toContain('aria-label="Green"');
    expect(chosen[0]).toContain('tabindex="0"');
    expect(swatches.filter((tag) => tag.includes('tabindex="0"'))).toHaveLength(1);
    expect(html.match(/<svg/g)).toHaveLength(1);
  });
});
