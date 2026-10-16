import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "../api";
import { HOME } from "../router";
import { GateScreen } from "./AuthGate";
import { LoginView, type LoginViewProps } from "./LoginPage";
import { accountMessage, loginMessage, sessionReasonMessage, waitText, wardSignInMessage } from "./messages";
import { AUTH_BASE_PATH, afterSignIn, forgetReturnPath, rememberReturnPath, wardReturnTo } from "./session";

/**
 * The sign-in screens without a browser: the login page's words and controls,
 * the gate's own screens, where signing in goes back to, and the 401 that
 * sends the app back to the login page. The session state itself is the
 * vendored hooks'.
 */

/** The markup, with the apostrophes React escapes put back, so the copy reads as written. */
function render(element: Parameters<typeof renderToStaticMarkup>[0]): string {
  return renderToStaticMarkup(element).replaceAll("&#x27;", "'");
}

function renderLogin(props: Partial<LoginViewProps> = {}): string {
  return render(createElement(LoginView, { wardEnabled: false, ...props }));
}

describe("LoginView", () => {
  it("has the wordmark, a username, a password and the Sign in pill", () => {
    const html = renderLogin();
    expect(html).toContain(">Almanac</h1>");
    expect(html).toContain(">Username</label>");
    expect(html).toContain('autoComplete="username"');
    expect(html).toContain(">Password</label>");
    expect(html).toContain('type="password"');
    expect(html).toContain('autoComplete="current-password"');
    expect(html).toMatch(/<button type="submit" class="button button--primary button--large button--pill[^"]*"[^>]*>Sign in<\/button>/);
  });

  it("offers Sign in with Ward under it only when the server has Ward", () => {
    expect(renderLogin()).not.toContain("Sign in with Ward");
    const html = renderLogin({ wardEnabled: true });
    expect(html).toContain(">Sign in with Ward</button>");
    expect(html.indexOf(">Sign in with Ward<")).toBeGreaterThan(html.indexOf(">Sign in<"));
  });

  it("has no way to register", () => {
    const html = renderLogin({ wardEnabled: true }).toLowerCase();
    expect(html).not.toContain("register");
    expect(html).not.toContain("create account");
    expect(html).not.toContain("sign up");
  });

  it("names the problem when the password is wrong", () => {
    const html = renderLogin({ error: { code: "invalid_credentials", status: 401 } });
    expect(html).toContain('role="alert"');
    expect(html).toContain("Wrong username or password.");
  });

  it("says why a Ward session ended, and says nothing after a plain sign-out", () => {
    expect(renderLogin({ reason: "ward_session_ended" })).toContain("Your Ward session ended. Sign in again.");
    expect(renderLogin({ reason: "ward_unavailable" })).toContain("Sign in with your password.");
    expect(renderLogin()).not.toContain('role="status"');
  });

  it("shows a Ward refusal in Almanac's words, with a way to dismiss it", () => {
    const html = renderLogin({ wardEnabled: true, wardError: { code: "access_denied" } });
    expect(html).toContain("Ward didn't let you in to Almanac.");
    expect(html).not.toContain("access_denied");
    expect(html).toContain(">Dismiss</button>");
  });

  it("says it is busy while signing in", () => {
    expect(renderLogin({ pending: true })).toContain(">Signing in…</button>");
  });
});

describe("GateScreen", () => {
  it("waits quietly while the session is asked for", () => {
    expect(render(createElement(GateScreen, { state: "loading" }))).toContain("Loading…");
  });

  it("offers to try again when Almanac can't be reached", () => {
    const html = render(createElement(GateScreen, { state: "unreachable", onRetry: () => {} }));
    expect(html).toContain("Almanac can't be reached.");
    expect(html).toContain(">Try again</button>");
  });
});

describe("messages", () => {
  it("says how long to wait after too many tries", () => {
    expect(loginMessage({ code: "too_many_attempts", retryAfterSeconds: 45 })).toBe("Too many tries. Wait 45 seconds, then try again.");
    expect(waitText(1)).toBe("1 second");
    expect(waitText(600)).toBe("10 minutes");
  });

  it("falls back on words of its own for a code it doesn't know", () => {
    expect(loginMessage({ code: "something_new" })).toBe("Couldn't sign in. Try again.");
    expect(wardSignInMessage({ code: "something_new" })).toContain("Couldn't sign in with Ward.");
    expect(accountMessage({ code: "something_new" })).toBe("That didn't work. Try again.");
    expect(sessionReasonMessage("session_check_failed")).toBeNull();
    expect(sessionReasonMessage(undefined)).toBeNull();
  });

  it("covers every code an account action can come back with", () => {
    for (const code of [
      "invalid_credentials",
      "password_too_short",
      "password_too_long",
      "already_linked",
      "ward_account_in_use",
      "ward_account_mismatch",
      "access_denied",
      "invalid_callback",
      "ward_unavailable",
      "no_local_password",
      "not_linked",
      "reauthentication_required",
      "unauthorized",
      "network",
    ]) {
      expect(accountMessage({ code })).not.toBe("That didn't work. Try again.");
    }
  });
});

describe("where signing in goes", () => {
  beforeEach(() => {
    vi.stubEnv("BASE_URL", "/almanac/");
    forgetReturnPath();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("goes home when there is nothing to go back to", () => {
    expect(afterSignIn()).toEqual(HOME);
    expect(wardReturnTo()).toBe("/almanac/");
  });

  it("goes back to the page the session ended on, at its canonical address", () => {
    rememberReturnPath("/almanac");
    expect(afterSignIn()).toEqual(HOME);
    expect(wardReturnTo()).toBe("/almanac/");
  });

  it("never goes back to the login page, or to a path the app doesn't have", () => {
    rememberReturnPath("/almanac/login");
    rememberReturnPath("/almanac/nope");
    rememberReturnPath("/elsewhere/");
    expect(afterSignIn()).toEqual(HOME);
    expect(wardReturnTo()).toBe("/almanac/");
  });
});

describe("a 401 from the API", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("has the session asked again, which shows the login page", async () => {
    const calls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        calls.push(url);
        return url === `${AUTH_BASE_PATH}/session`
          ? Response.json({ user: null, session: null, ward: { enabled: false, linked: false } })
          : Response.json({ error: "unauthorized" }, { status: 401 });
      }),
    );
    await expect(apiRequest("/api/calendars")).rejects.toMatchObject({ code: "signed_out" });
    await vi.waitFor(() => expect(calls).toContain("/almanac-api/auth/session"));
  });
});
