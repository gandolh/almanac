// @vitest-environment jsdom
import { CALENDAR_COLOR_KEYS } from "@almanac/shared";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ColorPicker } from "./ColorPicker";

afterEach(cleanup);

describe("ColorPicker", () => {
  it("shows the whole palette in order as a named group, the current colour pressed and ticked", () => {
    render(<ColorPicker value="green" onChange={() => undefined} />);
    expect(screen.getByRole("group", { name: "Colour" })).toBeTruthy();
    const swatches = screen.getAllByRole("button");
    expect(swatches.map((swatch) => swatch.getAttribute("aria-label"))).toEqual(
      CALENDAR_COLOR_KEYS.map((color) => color.charAt(0).toUpperCase() + color.slice(1)),
    );
    expect(swatches[0]?.style.getPropertyValue("--swatch")).toBe("var(--color-cal-blue)");
    expect(screen.getAllByRole("button", { pressed: true })).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Green", pressed: true }).querySelector("svg")).not.toBeNull();
    expect(document.querySelectorAll("svg")).toHaveLength(1);
  });

  it("has one Tab stop, and the arrow keys move focus without saving", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<ColorPicker value="green" onChange={onChange} />);
    expect(screen.getAllByRole("button").filter((swatch) => swatch.tabIndex === 0)).toHaveLength(1);
    await user.tab();
    await user.keyboard("{ArrowRight}{ArrowDown}{ArrowLeft}{ArrowUp}{End}{Home}");
    expect(document.activeElement).toBe(screen.getAllByRole("button")[0]);
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Green", pressed: true })).toBeTruthy();
  });

  it("saves once on Enter, Space or a click, and keeps one swatch pressed", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<ColorPicker value="green" onChange={onChange} />);
    await user.click(screen.getByRole("button", { name: "Red" }));
    expect(onChange).toHaveBeenCalledExactlyOnceWith("red");
    await user.click(screen.getByRole("button", { name: "Green" }));
    // Choosing the current colour again is reported again (the popover closes on it), never cleared.
    expect(onChange).toHaveBeenLastCalledWith("green");
    expect(screen.getAllByRole("button", { pressed: true })).toHaveLength(1);
  });

  it("puts focus on the chosen swatch when asked", () => {
    render(<ColorPicker value="teal" onChange={() => undefined} autoFocus />);
    expect(document.querySelector("[data-autofocus]")?.getAttribute("aria-label")).toBe("Teal");
  });
});
