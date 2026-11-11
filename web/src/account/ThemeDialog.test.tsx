// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setTheme } from "../layout/theme";
import { ThemeDialog } from "./ThemeDialog";

beforeEach(() => {
  window.localStorage.clear();
  document.head.innerHTML = '<meta name="color-scheme" content="light" /><meta name="theme-color" content="#FFFFFF" />';
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
  setTheme("light");
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("ThemeDialog", () => {
  it("offers Light, Dark and System, the current one chosen", async () => {
    render(<ThemeDialog open onClose={() => undefined} />);
    const group = await screen.findByRole("radiogroup", { name: "Theme" });
    expect(group).toBeTruthy();
    expect(screen.getAllByRole("radio").map((radio) => radio.getAttribute("aria-checked"))).toEqual([
      "true",
      "false",
      "false",
    ]);
    expect(screen.getByRole("radio", { name: /Light/ })).toBeTruthy();
    expect(screen.getByRole("radio", { name: /Dark/ })).toBeTruthy();
    expect(screen.getByRole("radio", { name: /System/ })).toBeTruthy();
  });

  it("applies a choice at once and keeps it on the device", async () => {
    const user = userEvent.setup();
    render(<ThemeDialog open onClose={() => undefined} />);
    await user.click(await screen.findByRole("radio", { name: /Dark/ }));
    await waitFor(() => expect(document.documentElement.dataset.theme).toBe("dark"));
    expect(window.localStorage.getItem("almanac.theme")).toBe("dark");
    await user.click(screen.getByRole("radio", { name: /System/ }));
    await waitFor(() => expect(document.documentElement.dataset.theme).toBe("system"));
    expect(window.localStorage.getItem("almanac.theme")).toBe("system");
  });

  it("closes with Done", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<ThemeDialog open onClose={onClose} />);
    await user.click(await screen.findByRole("button", { name: "Done" }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
