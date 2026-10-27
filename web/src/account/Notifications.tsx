import { Switch } from "@base-ui/react/switch";
import { useEffect, useId, useState } from "react";
import { isApiError } from "../api";
import { Button } from "../components/Button";
import { Dialog } from "../components/Dialog";
import { deletePushSubscription, getPushKey, savePushSubscription, sendTestPush } from "../push/push-api";
import {
  base64UrlToBytes,
  isIos,
  pushRegistration,
  pushSupport,
  readEnvironment,
  sameKey,
  subscribeWith,
  subscriptionBody,
} from "../push/subscription";
import "../push/notifications.css";

/**
 * The account menu's "Notifications" (brief 14): a switch that turns
 * notifications on in this browser, a "Send a test" button, and plain words
 * for every state the browser or the server can be in. Permission is asked
 * when the switch is turned on, never when the dialog opens. Turning it on
 * subscribes this browser and saves the subscription on the server; turning
 * it off unsubscribes and deletes it there. Copied from Satchel's
 * (`../satchel/web/src/settings/Notifications.tsx`).
 */

/** What the dialog shows. `ready` is the only state with a switch. */
export type NotificationsView =
  | { kind: "loading" }
  | { kind: "ios-home-screen" }
  | { kind: "ios-update" }
  | { kind: "unsupported" }
  | { kind: "server-off" }
  /** Couldn't check (a network error, say); worth another try. */
  | { kind: "check-failed" }
  | { kind: "ready"; on: boolean; permission: NotificationPermission; publicKey: string; ios: boolean };

export const MESSAGES = {
  loading: "Checking this browser…",
  "ios-home-screen":
    "On an iPhone, notifications work only in Almanac on the Home Screen. In Safari, tap Share, then Add to Home Screen, open Almanac from its new icon and turn this on there.",
  "ios-update": "Notifications need iOS 16.4 or later. Update the iPhone, then turn this on.",
  unsupported: "This browser can't show notifications from Almanac.",
  "server-off": "Notifications aren't set up on this server.",
  "check-failed": "Couldn't check notifications. Try again.",
  on: "On in this browser. Almanac can notify you here even when it's closed.",
  off: "Off in this browser.",
} as const;

/** How to undo a "Block", where the browser keeps it. */
export function blockedHelp(ios: boolean): string {
  return ios
    ? "Notifications are blocked for Almanac. Allow them in the iPhone's Settings, Notifications, Almanac, then come back here."
    : "Notifications are blocked for Almanac in this browser. Allow them in the site's settings (on a computer, the icon at the left of the address bar; on Android, Chrome's menu, Settings, Site settings, Notifications), then come back here.";
}

export interface NotificationsPanelProps {
  view: NotificationsView;
  busy?: boolean;
  /** A failure, shown as an alert. */
  error?: string | null;
  /** A quieter line: the test went out, or the permission prompt was dismissed. */
  note?: string | null;
  onToggle?: (on: boolean) => void;
  onTest?: () => void;
  onRetry?: () => void;
}

/** The dialog's body, without the browser: `NotificationsDialog` feeds it. */
export function NotificationsPanel({ view, busy = false, error = null, note = null, onToggle, onTest, onRetry }: NotificationsPanelProps) {
  const id = useId();
  const labelId = `${id}-label`;
  const stateId = `${id}-state`;
  return (
    <div className="notify" aria-busy={view.kind === "loading" || busy}>
      {view.kind === "ready" ? (
        <>
          <div className="notify-switch">
            <span className="notify-switch__text">
              <span className="notify-switch__label" id={labelId}>
                Notifications in this browser
              </span>
              <span className="notify-switch__state" id={stateId}>
                {view.permission === "denied" ? "Blocked in this browser." : view.on ? MESSAGES.on : MESSAGES.off}
              </span>
            </span>
            <Switch.Root
              className="switch"
              checked={view.on}
              aria-labelledby={labelId}
              aria-describedby={stateId}
              disabled={busy || view.permission === "denied"}
              onCheckedChange={(checked) => onToggle?.(checked)}
              data-autofocus=""
            >
              <Switch.Thumb className="switch__thumb" />
            </Switch.Root>
          </div>
          {view.permission === "denied" && <p className="notify-hint">{blockedHelp(view.ios)}</p>}
          {view.on && (
            <div className="notify-test">
              <Button onClick={onTest} disabled={busy}>
                Send a test
              </Button>
            </div>
          )}
        </>
      ) : view.kind === "ios-home-screen" || view.kind === "ios-update" ? (
        <p className="notify-hint">{MESSAGES[view.kind]}</p>
      ) : (
        <p className="notify-text">{MESSAGES[view.kind]}</p>
      )}
      {view.kind === "check-failed" && (
        <div className="notify-test">
          <Button onClick={onRetry}>Try again</Button>
        </div>
      )}
      {note && (
        <p className="notify-text" role="status">
          {note}
        </p>
      )}
      {error && (
        <p className="notify-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

/** Works out the dialog's state from this device, the browser and the server. */
async function loadView(): Promise<NotificationsView> {
  const env = readEnvironment();
  const support = pushSupport(env);
  if (support !== "ok") return { kind: support };

  let publicKey: string;
  try {
    publicKey = await getPushKey();
  } catch (error) {
    if (isApiError(error, "not_found")) return { kind: "server-off" };
    throw error;
  }

  const registration = await pushRegistration();
  if (registration === null) return { kind: "unsupported" };
  const permission = Notification.permission;
  const subscription = await registration.pushManager.getSubscription();
  const on =
    permission === "granted" &&
    subscription !== null &&
    sameKey(subscription.options.applicationServerKey, base64UrlToBytes(publicKey));
  if (on) {
    // Save it again: the server gives it to whoever is signed in now (a shared
    // browser that changed users) and learns it back if it lost it.
    const body = subscriptionBody(subscription.toJSON());
    if (body) savePushSubscription(body).catch(() => undefined);
  }
  return { kind: "ready", on, permission, publicKey, ios: isIos(env) };
}

function failureMessage(error: unknown, action: "on" | "off" | "test"): string {
  if (isApiError(error, "network")) return error.message;
  if (error instanceof DOMException) return "This browser couldn't set up notifications. Try again later.";
  if (action === "test") return "Couldn't send the test. Try again.";
  return action === "on" ? "Couldn't turn notifications on. Try again." : "Couldn't turn notifications off. Try again.";
}

export interface NotificationsDialogProps {
  open: boolean;
  onClose(): void;
}

/** Closed, it renders nothing; each opening checks the browser and the server afresh. */
export function NotificationsDialog({ open, onClose }: NotificationsDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Notifications"
      size="small"
      footer={
        <Button variant="quiet" onClick={onClose}>
          Done
        </Button>
      }
    >
      {open && <Notifications />}
    </Dialog>
  );
}

function Notifications() {
  const [view, setView] = useState<NotificationsView>({ kind: "loading" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    const check = () => {
      loadView().then(
        (next) => {
          if (live) setView(next);
        },
        (failure: unknown) => {
          // A failed re-check leaves a working switch as it was; a signed-out session shows the login page anyway.
          if (live && !isApiError(failure, "signed_out")) {
            setView((current) => (current.kind === "ready" ? current : { kind: "check-failed" }));
          }
        },
      );
    };
    check();
    // Back from the browser's settings (a block lifted, say): look again.
    const onVisible = () => {
      if (document.visibilityState === "visible") check();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      live = false;
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [attempt]);

  const start = () => {
    setBusy(true);
    setError(null);
    setNote(null);
  };

  if (view.kind !== "ready") {
    return (
      <NotificationsPanel
        view={view}
        onRetry={() => {
          setView({ kind: "loading" });
          setAttempt((n) => n + 1);
        }}
      />
    );
  }

  const turnOn = async () => {
    // First, before any other await: a browser shows the permission prompt only during the press.
    const asked = Notification.permission === "granted" ? Promise.resolve("granted" as const) : Notification.requestPermission();
    start();
    try {
      const permission = await asked;
      if (permission !== "granted") {
        setView({ ...view, on: false, permission });
        if (permission === "default") setNote("Almanac needs your permission to notify you. Turn this on again to be asked.");
        return;
      }
      const registration = await pushRegistration();
      if (registration === null) {
        setView({ kind: "unsupported" });
        return;
      }
      const subscription = await subscribeWith(registration, view.publicKey);
      const body = subscriptionBody(subscription.toJSON());
      if (body === null) throw new Error("The browser's subscription has no keys.");
      try {
        await savePushSubscription(body);
      } catch (failure) {
        // The server doesn't have it, so nothing would arrive: don't leave it half on.
        await subscription.unsubscribe().catch(() => undefined);
        throw failure;
      }
      setView({ ...view, on: true, permission });
    } catch (failure) {
      if (!isApiError(failure, "signed_out")) setError(failureMessage(failure, "on"));
    } finally {
      setBusy(false);
    }
  };

  const turnOff = async () => {
    start();
    try {
      const registration = await pushRegistration();
      const subscription = registration ? await registration.pushManager.getSubscription() : null;
      if (subscription !== null) {
        const { endpoint } = subscription;
        await deletePushSubscription(endpoint);
        await subscription.unsubscribe().catch(() => undefined);
      }
      setView({ ...view, on: false });
    } catch (failure) {
      if (!isApiError(failure, "signed_out")) setError(failureMessage(failure, "off"));
    } finally {
      setBusy(false);
    }
  };

  const test = async () => {
    start();
    try {
      const { sent } = await sendTestPush();
      if (sent > 0) setNote("Sent. It should show in a moment.");
      else setError("The test didn't reach this browser. Turn notifications off and on again, then try again.");
    } catch (failure) {
      if (!isApiError(failure, "signed_out")) setError(failureMessage(failure, "test"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <NotificationsPanel
      view={view}
      busy={busy}
      error={error}
      note={note}
      onToggle={(on) => void (on ? turnOn() : turnOff())}
      onTest={() => void test()}
    />
  );
}
