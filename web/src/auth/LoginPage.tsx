import { useEffect, useRef, useState, type FormEvent } from "react";
import { useLogin, useSession, useWardSignIn, type AuthError } from "../../vendor/ward/ward-auth-react.js";
import { Button } from "../components/Button";
import { useIsDesktop } from "../components/viewport";
import { AlertIcon, AuthField } from "../components/Field";
import { loginMessage, sessionReasonMessage, wardSignInMessage } from "./messages";
import { wardReturnTo } from "./session";
import "./auth.css";

export interface LoginViewProps {
  /** The server has Ward configured: "Sign in with Ward" shows only then. */
  wardEnabled: boolean;
  /** Why the last session ended (`ward_unavailable`, `ward_session_ended`), when the server said. */
  reason?: string;
  /** A password sign-in is on its way. */
  pending?: boolean;
  /** The last password sign-in failed. */
  error?: AuthError | null;
  /** On its way to Ward. */
  wardPending?: boolean;
  /** "Sign in with Ward" failed: from the button, or from Ward sending the browser back. */
  wardError?: AuthError | null;
  /** Focus the username field when the page opens (the desktop: a phone would raise its keyboard over the page). */
  autoFocus?: boolean;
  /** Resolves true when signed in. On false the password is cleared and focused for another try. */
  onLogin?: (username: string, password: string) => Promise<boolean>;
  onWard?: () => void;
  onDismissWard?: () => void;
}

type Missing = "username" | "password" | null;

/**
 * The login page without the hooks, so a test can render it: the wordmark,
 * username, password, the "Sign in" pill and, when the server has Ward,
 * "Sign in with Ward" under it. No sign-up link: the first user comes from
 * the seed (`npm run seed`), and anyone else through Ward once the owner
 * grants them Almanac there.
 */
export function LoginView({
  wardEnabled,
  reason,
  pending = false,
  error = null,
  wardPending = false,
  wardError = null,
  autoFocus = false,
  onLogin,
  onWard,
  onDismissWard,
}: LoginViewProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [missing, setMissing] = useState<Missing>(null);
  const usernameRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const notice = sessionReasonMessage(reason);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (pending) return;
    const name = username.trim();
    const empty: Missing = name === "" ? "username" : password === "" ? "password" : null;
    setMissing(empty);
    if (empty !== null) {
      (empty === "username" ? usernameRef : passwordRef).current?.focus();
      return;
    }
    void onLogin?.(name, password).then((signedIn) => {
      if (signedIn) return;
      setPassword("");
      passwordRef.current?.focus();
    });
  };

  return (
    <main className="gate" aria-busy={pending || wardPending || undefined}>
      <div className="gate__column">
        <header className="gate__head">
          <h1 className="gate__wordmark">Almanac</h1>
          <p className="gate__lede">Sign in to your calendar.</p>
        </header>

        {notice !== null && (
          <p className="gate__notice" role="status">
            {notice}
          </p>
        )}

        <div className="login__panel">
          <form className="login__form" onSubmit={submit} noValidate aria-label="Sign in">
            <AuthField
              ref={usernameRef}
              label="Username"
              name="username"
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="next"
              autoFocus={autoFocus}
              value={username}
              error={missing === "username" ? "Enter your username." : undefined}
              onChange={(event) => {
                setUsername(event.target.value);
                if (missing === "username") setMissing(null);
              }}
            />
            <AuthField
              ref={passwordRef}
              label="Password"
              name="password"
              type="password"
              autoComplete="current-password"
              enterKeyHint="go"
              value={password}
              error={missing === "password" ? "Enter your password." : undefined}
              onChange={(event) => {
                setPassword(event.target.value);
                if (missing === "password") setMissing(null);
              }}
            />
            {error !== null && (
              <p className="auth-error" role="alert">
                <AlertIcon />
                <span className="auth-error__text">{loginMessage(error)}</span>
              </p>
            )}
            <Button type="submit" variant="primary" size="large" block className="login__submit" disabled={pending}>
              {pending ? "Signing in…" : "Sign in"}
            </Button>
          </form>

          {wardEnabled && (
            <div className="login__ward">
              <p className="login__or" aria-hidden="true">
                or
              </p>
              <Button variant="secondary" pill size="large" block disabled={wardPending} onClick={onWard}>
                {wardPending ? "Opening Ward…" : "Sign in with Ward"}
              </Button>
              {wardError !== null && (
                <p className="auth-error" role="alert">
                  <AlertIcon />
                  <span className="auth-error__text">{wardSignInMessage(wardError)}</span>
                  <Button variant="quiet" size="compact" className="auth-error__dismiss" onClick={onDismissWard}>
                    Dismiss
                  </Button>
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

/** The auth gate's signed-out screen: `LoginView` on the vendored hooks. */
export function LoginPage() {
  const session = useSession();
  const { login, pending, error } = useLogin();
  const ward = useWardSignIn();
  const desktop = useIsDesktop();

  useEffect(() => {
    document.title = "Sign in · Almanac";
  }, []);

  const signedOut = session.status === "signed_out" ? session : null;
  return (
    <LoginView
      wardEnabled={signedOut?.ward.enabled ?? false}
      {...(signedOut?.reason !== undefined ? { reason: signedOut.reason } : {})}
      pending={pending}
      error={error}
      wardPending={ward.pending}
      wardError={ward.error}
      autoFocus={desktop}
      onLogin={async (username, password) => {
        const signedIn = await login(username, password);
        // A Ward failure the page was showing is moot now; it must not follow into the app's account notice.
        if (signedIn) ward.reset();
        return signedIn;
      }}
      onWard={() => void ward.signIn({ returnTo: wardReturnTo() })}
      onDismissWard={ward.reset}
    />
  );
}
