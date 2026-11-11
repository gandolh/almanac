// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { RadioGroup, RadioIndicator, RadioItem } from "./RadioGroup";

afterEach(cleanup);

function Zones() {
  const [value, setValue] = useState("b");
  return (
    <>
      <input aria-label="Search" />
      <RadioGroup<string> aria-label="Zones" value={value} onValueChange={setValue}>
        {["a", "b", "c", "d"].map((zone) => (
          <RadioItem key={zone} value={zone} aria-label={zone}>
            <RadioIndicator>✓</RadioIndicator>
          </RadioItem>
        ))}
      </RadioGroup>
    </>
  );
}

const chosen = () => screen.getByRole("radio", { checked: true }).getAttribute("aria-label");

describe("RadioGroup", () => {
  it("has one Tab stop, on the chosen item, and the arrow keys move and choose", async () => {
    const user = userEvent.setup();
    render(<Zones />);
    const stops = screen.getAllByRole("radio").filter((radio) => radio.tabIndex === 0);
    expect(stops.map((radio) => radio.getAttribute("aria-label"))).toEqual(["b"]);
    await user.tab();
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole("radio", { name: "b" }));
    await user.keyboard("{ArrowDown}");
    expect(chosen()).toBe("c");
    expect(document.activeElement).toBe(screen.getByRole("radio", { name: "c" }));
    await user.keyboard("{ArrowUp}{ArrowUp}");
    expect(chosen()).toBe("a");
  });

  it("goes to the first and last item with Home and End, and chooses them", async () => {
    const user = userEvent.setup();
    render(<Zones />);
    await user.tab();
    await user.tab();
    await user.keyboard("{End}");
    expect(chosen()).toBe("d");
    expect(document.activeElement).toBe(screen.getByRole("radio", { name: "d" }));
    await user.keyboard("{Home}");
    expect(chosen()).toBe("a");
  });

  it("shows the indicator only on the chosen item", () => {
    render(<Zones />);
    expect(screen.getAllByText("✓")).toHaveLength(1);
  });
});
