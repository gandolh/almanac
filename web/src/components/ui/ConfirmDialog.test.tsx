// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ConfirmDialog } from "./ConfirmDialog";

afterEach(cleanup);

/** A confirm whose action waits for `release()`. */
function setup(extra: { confirmDisabled?: boolean } = {}) {
  let release: () => void = () => undefined;
  const onConfirm = vi.fn(
    () =>
      new Promise<void>((resolve) => {
        release = resolve;
      }),
  );
  const onClose = vi.fn();
  render(
    <ConfirmDialog
      open
      onClose={onClose}
      title="Delete calendar"
      message={<p>Delete &quot;Work&quot;?</p>}
      confirmLabel="Delete"
      pendingLabel="Deleting…"
      onConfirm={onConfirm}
      {...extra}
    />,
  );
  return { onConfirm, onClose, release: () => release() };
}

describe("ConfirmDialog", () => {
  it("is an alert dialog named by its title, with Cancel in focus", async () => {
    setup();
    const dialog = await screen.findByRole("alertdialog", { name: "Delete calendar" });
    expect(dialog.textContent).toContain('Delete "Work"?');
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("button", { name: "Cancel" })));
  });

  it("closes with Cancel, ✕ or Esc", async () => {
    const user = userEvent.setup();
    const { onClose } = setup();
    await screen.findByRole("alertdialog");
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await user.click(screen.getByRole("button", { name: "Close" }));
    await user.keyboard("{Escape}");
    await waitFor(() => expect(onClose.mock.calls.length).toBeGreaterThanOrEqual(3));
  });

  it("can't be closed by Esc, ✕ or Cancel while its action runs, and says Deleting…", async () => {
    const user = userEvent.setup();
    const { onConfirm, onClose, release } = setup();
    await screen.findByRole("alertdialog");
    await user.click(screen.getByRole("button", { name: "Delete" }));
    expect(onConfirm).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "Deleting…" })).toBeTruthy();
    await user.keyboard("{Escape}");
    await user.click(screen.getByRole("button", { name: "Close" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onClose).not.toHaveBeenCalled();
    release();
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
  });

  it("runs the action once, however often it is pressed", async () => {
    const user = userEvent.setup();
    const { onConfirm } = setup();
    await screen.findByRole("alertdialog");
    await user.dblClick(screen.getByRole("button", { name: "Delete" }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it("leaves the action off when it is disabled", async () => {
    const user = userEvent.setup();
    const { onConfirm } = setup({ confirmDisabled: true });
    await screen.findByRole("alertdialog");
    await user.click(screen.getByRole("button", { name: "Delete" }));
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
