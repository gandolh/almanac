// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { showToast, Toaster } from "./Toast";

afterEach(() => {
  cleanup();
});

const show = (...args: Parameters<typeof showToast>) => {
  let dismiss: () => void = () => undefined;
  act(() => {
    dismiss = showToast(...args);
  });
  return dismiss;
};

describe("Toast", () => {
  it("has its live region before the first toast", () => {
    render(<Toaster />);
    expect(screen.getByRole("region", { name: "Notifications" })).toBeTruthy();
  });

  it("shows a message with a Dismiss button, and one toast replaces the last", async () => {
    render(<Toaster />);
    show("Event deleted");
    expect(await screen.findByText("Event deleted")).toBeTruthy();
    show("Calendar deleted");
    expect(await screen.findByText("Calendar deleted")).toBeTruthy();
    await waitFor(() => expect(screen.queryByText("Event deleted")).toBeNull());
    // Each toast is a dialog; its Dismiss button is out of the accessibility tree until F6 reaches the region.
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    expect(screen.getAllByLabelText("Dismiss")).toHaveLength(1);
  });

  it("closes by its dismiss function, and goes by itself after its duration", async () => {
    render(<Toaster />);
    const dismiss = show("First");
    await screen.findByText("First");
    act(() => dismiss());
    await waitFor(() => expect(screen.queryByText("First")).toBeNull());
    show("Second", { duration: 50 });
    await screen.findByText("Second");
    await waitFor(() => expect(screen.queryByText("Second")).toBeNull());
  });

  it("runs the action once and closes", async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();
    render(<Toaster />);
    show("Couldn't load", { action: { label: "Retry", onAction } });
    await user.click(await screen.findByRole("button", { name: "Retry", hidden: true }));
    expect(onAction).toHaveBeenCalledOnce();
    await waitFor(() => expect(screen.queryByText("Couldn't load")).toBeNull());
  });

  it("keeps an error until it is dismissed, whatever its duration", async () => {
    render(<Toaster />);
    show("Couldn't save", { type: "error", duration: 30 });
    await screen.findAllByText("Couldn't save");
    await new Promise((resolve) => setTimeout(resolve, 200));
    // A high-priority toast is announced through a second, hidden copy.
    expect(screen.getAllByText("Couldn't save").length).toBeGreaterThan(0);
  });
});
