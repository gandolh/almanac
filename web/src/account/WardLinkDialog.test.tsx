// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const session = vi.hoisted(() => ({
  hasPassword: true,
}));

vi.mock("../../vendor/ward/ward-auth-react.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../vendor/ward/ward-auth-react.js")>()),
  useSession: () => ({
    status: "signed_in",
    user: { id: "u1", username: "owner", role: "user", hasPassword: session.hasPassword },
    session: { origin: "local", expiresAt: 0 },
    ward: { enabled: true, linked: false },
  }),
}));
vi.mock("./actions", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./actions")>()),
  linkWard: vi.fn(),
  unlinkWard: vi.fn(),
}));

import { AccountActionError, linkWard, unlinkWard } from "./actions";
import { WardLinkDialog } from "./WardLinkDialog";

beforeEach(() => {
  session.hasPassword = true;
  vi.mocked(linkWard).mockReset();
  vi.mocked(unlinkWard).mockReset();
});
afterEach(cleanup);

function setup(mode: "link" | "unlink") {
  const onClose = vi.fn();
  const onSetPassword = vi.fn();
  render(<WardLinkDialog mode={mode} onClose={onClose} onSetPassword={onSetPassword} />);
  return { onClose, onSetPassword };
}

describe("WardLinkDialog", () => {
  it("has a labelled password field with the right autocomplete, in focus", async () => {
    setup("link");
    const field = await screen.findByLabelText("Current password");
    expect(field.getAttribute("type")).toBe("password");
    expect(field.getAttribute("autocomplete")).toBe("current-password");
    await waitFor(() => expect(document.activeElement).toBe(field));
  });

  it("links with the typed password", async () => {
    const user = userEvent.setup();
    vi.mocked(linkWard).mockResolvedValue(undefined);
    setup("link");
    await user.type(await screen.findByLabelText("Current password"), "hunter22");
    await user.click(screen.getByRole("button", { name: "Link Ward" }));
    expect(linkWard).toHaveBeenCalledWith("hunter22");
  });

  it("shows a wrong password beside the field and keeps focus there", async () => {
    const user = userEvent.setup();
    vi.mocked(linkWard).mockRejectedValue(new AccountActionError({ code: "invalid_credentials" }));
    setup("link");
    const field = await screen.findByLabelText("Current password");
    await user.type(field, "wrong");
    await user.click(screen.getByRole("button", { name: "Link Ward" }));
    expect(await screen.findByText("That isn't your current password.")).toBeTruthy();
    expect(document.activeElement).toBe(field);
    expect(field.getAttribute("aria-invalid")).toBe("true");
  });

  it("says how long to wait after too many tries", async () => {
    const user = userEvent.setup();
    vi.mocked(unlinkWard).mockRejectedValue(
      new AccountActionError({ code: "too_many_attempts", retryAfterSeconds: 30 }),
    );
    setup("unlink");
    await user.type(await screen.findByLabelText("Current password"), "x");
    await user.click(screen.getByRole("button", { name: "Unlink Ward" }));
    expect(await screen.findByText("Too many tries. Wait 30 seconds, then try again.")).toBeTruthy();
  });

  it("asks for a password before sending anything", async () => {
    const user = userEvent.setup();
    setup("unlink");
    await user.click(await screen.findByRole("button", { name: "Unlink Ward" }));
    expect(await screen.findByText("Enter your current password.")).toBeTruthy();
    expect(unlinkWard).not.toHaveBeenCalled();
  });

  it("unlinks with the password and closes", async () => {
    const user = userEvent.setup();
    vi.mocked(unlinkWard).mockResolvedValue(undefined);
    const { onClose } = setup("unlink");
    await user.type(await screen.findByLabelText("Current password"), "hunter22");
    await user.click(screen.getByRole("button", { name: "Unlink Ward" }));
    expect(unlinkWard).toHaveBeenCalledWith("hunter22");
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it("sends an account with no password to set one first", async () => {
    session.hasPassword = false;
    const user = userEvent.setup();
    const { onSetPassword } = setup("unlink");
    expect(screen.queryByLabelText("Current password")).toBeNull();
    await user.click(await screen.findByRole("button", { name: "Set a password" }));
    expect(onSetPassword).toHaveBeenCalled();
    expect(unlinkWard).not.toHaveBeenCalled();
  });
});
