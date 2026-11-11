// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Drawer } from "./Drawer";

afterEach(cleanup);

function setup({ withRename = false } = {}) {
  const onClose = vi.fn();
  const returnFocus = createRef<HTMLButtonElement>();
  render(
    <>
      <button ref={returnFocus}>Main menu</button>
      <Drawer open onClose={onClose} returnFocus={returnFocus}>
        <button>Create</button>
        {withRename && (
          <input
            aria-label="Rename"
            onKeyDown={(event) => {
              // What the rename field does: its Esc is its own.
              if (event.key === "Escape") event.preventDefault();
            }}
          />
        )}
      </Drawer>
    </>,
  );
  return { onClose };
}

describe("Drawer", () => {
  it("is a dialog named Calendars, and focus starts on Create", async () => {
    setup();
    expect(await screen.findByRole("dialog", { name: "Calendars" })).toBeTruthy();
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("button", { name: "Create" })));
  });

  it("closes on Esc", async () => {
    const user = userEvent.setup();
    const { onClose } = setup();
    await screen.findByRole("dialog");
    await user.keyboard("{Escape}");
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
  });

  it("lets Esc close a rename field inside it without closing the drawer", async () => {
    const user = userEvent.setup();
    const { onClose } = setup({ withRename: true });
    await screen.findByRole("dialog");
    await user.click(screen.getByRole("textbox", { name: "Rename" }));
    await user.keyboard("{Escape}");
    expect(onClose).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Create" }));
    await user.keyboard("{Escape}");
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
  });
});
