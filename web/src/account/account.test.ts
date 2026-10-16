import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { linkWard, signOut, unlinkWard, wardLinkOf } from "./actions";
import { checkPasswords } from "./ChangePassword";

const SIGNED_IN = {
  status: "signed_in",
  user: { id: "u1", username: "owner", role: "user", hasPassword: true },
  session: { origin: "local", expiresAt: 0 },
} as const;

describe("the menu's Ward row", () => {
  it("is offered only when signed in to a server that has Ward, and says whether it is linked", () => {
    expect(wardLinkOf({ ...SIGNED_IN, ward: { enabled: true, linked: true } })).toEqual({ available: true, linked: true });
    expect(wardLinkOf({ ...SIGNED_IN, ward: { enabled: false, linked: false } })).toEqual({ available: false, linked: false });
    expect(wardLinkOf({ status: "signed_out", ward: { enabled: true, linked: false } })).toEqual({ available: false, linked: false });
    expect(wardLinkOf({ status: "loading" })).toEqual({ available: false, linked: false });
  });
});

describe("checkPasswords", () => {
  it("wants the current password, then 8 characters, then the same new one twice", () => {
    expect(checkPasswords({ current: "", next: "long enough", repeat: "long enough" }, true)).toEqual({
      current: "Enter your current password.",
    });
    expect(checkPasswords({ current: "old", next: "short", repeat: "short" }, true)).toEqual({ next: "Use at least 8 characters." });
    expect(checkPasswords({ current: "old", next: "long enough", repeat: "long enouhg" }, true)).toEqual({
      repeat: "The new passwords don't match.",
    });
    expect(checkPasswords({ current: "old", next: "long enough", repeat: "long enough" }, true)).toEqual({});
  });

  it("doesn't ask for a current password the account doesn't have", () => {
    expect(checkPasswords({ current: "", next: "long enough", repeat: "long enough" }, false)).toEqual({});
  });
});

describe("the account actions", () => {
  beforeEach(() => {
    vi.stubEnv("BASE_URL", "/almanac/");
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  function serve(status: number, body?: unknown) {
    const calls: { url: string; method: string | undefined }[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        calls.push({ url, method: init?.method });
        return body === undefined ? new Response(null, { status }) : Response.json(body, { status });
      }),
    );
    return calls;
  }

  it("signs out, then loads the login page afresh", async () => {
    const replace = vi.fn();
    vi.stubGlobal("window", { location: { replace } });
    const calls = serve(204);
    await signOut();
    expect(calls).toEqual([{ url: "/almanac-api/auth/logout", method: "POST" }]);
    expect(replace).toHaveBeenCalledWith("/almanac/login");
  });

  it("says why it couldn't sign out, and stays", async () => {
    const replace = vi.fn();
    vi.stubGlobal("window", { location: { replace } });
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new TypeError("offline"))));
    await expect(signOut()).rejects.toThrow("Almanac can't be reached.");
    expect(replace).not.toHaveBeenCalled();
  });

  it("says when Ward can't be reached to link", async () => {
    serve(503, { error: "ward_unavailable" });
    await expect(linkWard()).rejects.toThrow("Ward isn't answering right now. Try again later.");
  });

  it("unlinks, and when this session began with Ward and ends with it, loads the login page afresh", async () => {
    const replace = vi.fn();
    vi.stubGlobal("window", { location: { replace } });
    serve(200, { signedOut: true });
    await unlinkWard();
    expect(replace).toHaveBeenCalledWith("/almanac/login");
  });

  it("says a password must come before unlinking", async () => {
    serve(409, { error: "no_local_password" });
    await expect(unlinkWard()).rejects.toThrow("Set an Almanac password first");
  });
});
