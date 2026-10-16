import { ChangePasswordDialog } from "./account/ChangePassword";
import { AuthGate } from "./auth/AuthGate";
import { EventEditorProvider } from "./event/EventEditor";
import { AppShell } from "./layout/AppShell";

/**
 * The app: signed out, the login page (the auth gate's); signed in, the
 * calendar's shell inside the event editor (brief 07's quick create and
 * event form, which any view opens through `useEventEditor()`), and the
 * password dialog, closed until the account menu asks for it.
 */
export function App() {
  return (
    <AuthGate>
      <EventEditorProvider>
        <AppShell />
      </EventEditorProvider>
      <ChangePasswordDialog />
    </AuthGate>
  );
}
