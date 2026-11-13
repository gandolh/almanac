import { useEffect, type ReactNode } from "react";
import { useSession } from "../../vendor/ward/ward-auth-react.js";
import { Button } from "../components/Button";
import { GATE_CLASS } from "../components/looks";
import { LOGIN, navigate, useMatchedRoute } from "../router";
import { LoginPage } from "./LoginPage";
import { afterSignIn, forgetReturnPath, rememberReturnPath } from "./session";

/**
 * The session gate around the whole app. The vendored hooks hold the session
 * (`useSession`: one shared state, asked of `GET /almanac-api/auth/session`):
 *
 * - loading: the ground, then a quiet "Loading…" if it takes a moment;
 * - signed out: the address becomes `/almanac/login` and the login page
 *   shows, with the reason when a session just ended. The page the person was
 *   on is remembered;
 * - signed in: the app. On `/login` (just signed in, or a bookmark) it goes on
 *   to the remembered page, or home;
 * - the session question failing (the server is down): "Can't reach
 *   Almanac", with Retry.
 *
 * Any API call answered 401 asks the session again (`session.ts`), so a
 * session that ends while the app is open lands on the login page too.
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const session = useSession();
  switch (session.status) {
    case "loading":
      return <GateScreen state="loading" />;
    case "error":
      return <GateScreen state="unreachable" onRetry={() => void session.refresh()} />;
    case "signed_out":
      return <SignedOut />;
    case "signed_in":
      return <SignedIn>{children}</SignedIn>;
  }
}

function SignedOut() {
  const atLogin = useMatchedRoute()?.name === "login";
  useEffect(() => {
    if (atLogin) return;
    rememberReturnPath(window.location.pathname);
    navigate(LOGIN, { replace: true });
  }, [atLogin]);
  return <LoginPage />;
}

function SignedIn({ children }: { children: ReactNode }) {
  const atLogin = useMatchedRoute()?.name === "login";
  useEffect(() => {
    if (atLogin) navigate(afterSignIn(), { replace: true });
    else forgetReturnPath();
  }, [atLogin]);
  // Nothing for the instant `/login` is replaced, so the shell never mounts on it.
  return atLogin ? null : children;
}

export interface GateScreenProps {
  state: "loading" | "unreachable";
  onRetry?: () => void;
}

/** What the gate shows instead of the app or the login page. Pure, so a test can render it. */
export function GateScreen({ state, onRetry }: GateScreenProps) {
  return (
    <main className={GATE_CLASS} aria-busy={state === "loading" || undefined}>
      <div className="flex w-full max-w-[380px] flex-col gap-6">
        <header className="flex flex-col gap-1.5 px-1">
          <h1 className="font-num text-title leading-tight font-bold tracking-title text-ink max-md:text-title-phone">
            Almanac
          </h1>
          {state === "loading" ? (
            <p className="animate-gate-wait-in text-meta text-muted">Loading…</p>
          ) : (
            <p className="text-body leading-tight text-muted" role="alert">
              Almanac can't be reached. Check your connection and try again.
            </p>
          )}
        </header>
        {state === "unreachable" && (
          <div className="flex flex-wrap gap-3">
            <Button variant="secondary" onClick={onRetry}>
              Try again
            </Button>
          </div>
        )}
      </div>
    </main>
  );
}
