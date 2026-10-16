import { useEffect, useState } from "react";
import { useSession } from "../vendor/ward/ward-auth-react.js";
import { changePassword, signOut } from "./account/actions";
import { ChangePasswordDialog } from "./account/ChangePassword";
import { AuthGate } from "./auth/AuthGate";
import { AlertIcon } from "./auth/icons";
import { Button } from "./components/Button";

/**
 * The app: signed out, the login page (the auth gate's); signed in, the home
 * placeholder, and the password dialog, closed until asked for. Brief 05
 * puts the calendar's shell in the placeholder's place, with the account
 * menu that opens the same dialog.
 */
export function App() {
  return (
    <AuthGate>
      <Home />
      <ChangePasswordDialog />
    </AuthGate>
  );
}

export interface HomeViewProps {
  username: string;
  /** Why the last action failed, in words for the user. */
  failure?: string;
  onChangePassword?: () => void;
  onSignOut?: () => void;
}

/** The placeholder without the hooks, so a test can render it: who is signed in, and the two account actions. */
export function HomeView({ username, failure = "", onChangePassword, onSignOut }: HomeViewProps) {
  return (
    <main className="gate">
      <div className="gate__column">
        <header className="gate__head">
          <h1 className="gate__wordmark">Almanac</h1>
          <p className="gate__lede">Signed in as {username}.</p>
        </header>
        {failure !== "" && (
          <p className="auth-error" role="alert">
            <AlertIcon />
            <span className="auth-error__text">{failure}</span>
          </p>
        )}
        <div className="gate__actions">
          <Button variant="secondary" pill onClick={onChangePassword}>
            Change password
          </Button>
          <Button variant="secondary" pill onClick={onSignOut}>
            Sign out
          </Button>
        </div>
      </div>
    </main>
  );
}

/** Signed in: the placeholder home, until brief 05's shell. */
function Home() {
  const session = useSession();
  const [failure, setFailure] = useState("");

  useEffect(() => {
    document.title = "Almanac";
  }, []);

  // An action that fails says why here; signing out leaves the page when it works.
  const run = (action: () => Promise<void>) => () => {
    setFailure("");
    action().catch((error: unknown) => setFailure(error instanceof Error ? error.message : "That didn't work. Try again."));
  };

  return (
    <HomeView
      username={session.status === "signed_in" ? session.user.username : ""}
      failure={failure}
      onChangePassword={run(changePassword)}
      onSignOut={run(signOut)}
    />
  );
}
