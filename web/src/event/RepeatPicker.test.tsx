// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { repeatDraftOf, type RepeatDraft } from "./editor-state";
import { RepeatPicker } from "./RepeatPicker";

afterEach(cleanup);

const custom = (days: RepeatDraft["days"]): RepeatDraft => ({
  ...repeatDraftOf(null, "2026-10-16"),
  preset: "custom",
  days,
});

function setup(days: RepeatDraft["days"]) {
  const onChange = vi.fn();
  render(
    <RepeatPicker
      repeat={custom(days)}
      labelDate="2026-10-16"
      startDate="2026-10-16"
      timeZone="Europe/Bucharest"
      onChange={onChange}
    />,
  );
  return { onChange };
}

describe("the weekday toggles of Custom days…", () => {
  it("name each day in full and press the chosen ones", () => {
    setup(["MO", "WE"]);
    expect(screen.getByRole("group", { name: "Repeat on" })).toBeTruthy();
    expect(screen.getAllByRole("button", { pressed: true }).map((day) => day.getAttribute("aria-label"))).toEqual([
      "Monday",
      "Wednesday",
    ]);
    expect(screen.getAllByRole("button", { pressed: false })).toHaveLength(5);
  });

  it("are one Tab stop, with the arrow keys moving focus and Space pressing, in week order", async () => {
    const user = userEvent.setup();
    const { onChange } = setup(["MO", "WE"]);
    expect(screen.getAllByRole("button").filter((day) => day.tabIndex === 0)).toHaveLength(1);
    await user.tab(); // the Repeat list
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Monday" }));
    await user.keyboard("{ArrowRight}");
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Tuesday" }));
    expect(onChange).not.toHaveBeenCalled();
    await user.keyboard(" ");
    expect(onChange).toHaveBeenCalledOnce();
    expect(onChange.mock.calls[0]?.[0]).toMatchObject({ days: ["MO", "TU", "WE"] });
  });

  it("keep the last day", async () => {
    const user = userEvent.setup();
    const { onChange } = setup(["FR"]);
    await user.click(screen.getByRole("button", { name: "Friday" }));
    expect(onChange.mock.calls.every(([next]) => (next as RepeatDraft).days.join() === "FR")).toBe(true);
  });
});
