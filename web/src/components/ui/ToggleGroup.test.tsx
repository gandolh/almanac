// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ToggleGroup, ToggleItem } from "./ToggleGroup";

afterEach(cleanup);

type Letter = "a" | "b" | "c";

function Picker({ onChoice }: { onChoice: (value: Letter) => void }) {
  const [value, setValue] = useState<Letter>("a");
  return (
    <ToggleGroup<Letter>
      label="Letter"
      value={value}
      onValueChange={(next) => {
        setValue(next);
        onChoice(next);
      }}
    >
      <ToggleItem value="a">A</ToggleItem>
      <ToggleItem value="b">B</ToggleItem>
      <ToggleItem value="c">C</ToggleItem>
    </ToggleGroup>
  );
}

describe("the guarded ToggleGroup", () => {
  it("has one Tab stop and moves focus with the arrow keys without choosing", async () => {
    const onChoice = vi.fn();
    const user = userEvent.setup();
    render(<Picker onChoice={onChoice} />);
    expect(screen.getAllByRole("button").filter((button) => button.tabIndex === 0)).toHaveLength(1);
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "A" }));
    await user.keyboard("{ArrowRight}");
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "B" }));
    await user.keyboard("{ArrowDown}");
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "C" }));
    await user.keyboard("{ArrowUp}");
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "B" }));
    expect(onChoice).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "A", pressed: true })).toBeTruthy();
  });

  it("chooses once on Enter or a click, and one item stays pressed", async () => {
    const onChoice = vi.fn();
    const user = userEvent.setup();
    render(<Picker onChoice={onChoice} />);
    await user.click(screen.getByRole("button", { name: "C" }));
    expect(onChoice).toHaveBeenCalledExactlyOnceWith("c");
    expect(screen.getAllByRole("button", { pressed: true })).toHaveLength(1);
    expect(screen.getByRole("button", { name: "C", pressed: true })).toBeTruthy();
  });

  it("reports the pressed item again, and keeps it pressed, when it is chosen again", async () => {
    const onChoice = vi.fn();
    const user = userEvent.setup();
    render(<Picker onChoice={onChoice} />);
    await user.click(screen.getByRole("button", { name: "A" }));
    expect(onChoice).toHaveBeenCalledExactlyOnceWith("a");
    expect(screen.getByRole("button", { name: "A", pressed: true })).toBeTruthy();
  });
});

describe("the multiple ToggleGroup", () => {
  it("presses any number of items and moves focus by arrow keys", async () => {
    const onValueChange = vi.fn();
    const user = userEvent.setup();
    render(
      <ToggleGroup multiple label="Days" value={["a"]} onValueChange={onValueChange}>
        <ToggleItem value="a">A</ToggleItem>
        <ToggleItem value="b">B</ToggleItem>
      </ToggleGroup>,
    );
    await user.tab();
    await user.keyboard("{ArrowRight}");
    expect(onValueChange).not.toHaveBeenCalled();
    await user.keyboard("{Enter}");
    expect(onValueChange).toHaveBeenCalledExactlyOnceWith(["a", "b"]);
  });
});
