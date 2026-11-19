// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AuthError } from "../../vendor/ward/ward-auth-react.js";

const rename = vi.hoisted(() => ({
  renameUser: vi.fn(),
  reset: vi.fn(),
  error: null as AuthError | null,
  done: false,
}));

vi.mock("../auth/session", () => ({}));
vi.mock("../../vendor/ward/ward-auth-react.js", () => ({
  useSession: () => ({
    status: "signed_in",
    user: { id: "u1", username: "owner", role: "user", hasPassword: true },
    session: { origin: "local", expiresAt: 0 },
    ward: { enabled: false, linked: false },
  }),
  useRenameUser: () => ({
    pending: false,
    renameUser: rename.renameUser,
    reset: rename.reset,
    error: rename.error,
    done: rename.done,
  }),
}));

import { ChangeUsernameDialog } from "./ChangeUsername";

afterEach(() => {
  cleanup();
  rename.renameUser.mockReset();
  rename.error = null;
  rename.done = false;
});

describe("ChangeUsernameDialog", () => {
  it("starts with the current name and sends the trimmed new one", async () => {
    const user = userEvent.setup();
    rename.renameUser.mockResolvedValue(true);
    render(<ChangeUsernameDialog onClose={() => undefined} />);
    const field = await screen.findByLabelText("Username");
    expect((field as HTMLInputElement).value).toBe("owner");
    await user.clear(field);
    await user.type(field, "  alice  ");
    await user.click(screen.getByRole("button", { name: "Change username" }));
    expect(rename.renameUser).toHaveBeenCalledWith("alice");
  });

  it("says a taken or look-alike name is taken, beside the field", async () => {
    rename.error = { code: "username_taken", status: 409 };
    render(<ChangeUsernameDialog onClose={() => undefined} />);
    expect(await screen.findByText(/That username is taken/)).toBeTruthy();
  });

  it("asks for a name, and closes without a call when nothing changed", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<ChangeUsernameDialog onClose={onClose} />);
    const field = await screen.findByLabelText("Username");
    await user.click(screen.getByRole("button", { name: "Change username" }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    await user.clear(field);
    await user.click(screen.getByRole("button", { name: "Change username" }));
    expect(await screen.findByText("Enter a username.")).toBeTruthy();
    expect(rename.renameUser).not.toHaveBeenCalled();
  });
});
