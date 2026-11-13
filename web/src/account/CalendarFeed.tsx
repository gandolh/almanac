import { useEffect, useId, useState } from "react";
import { isApiError } from "../api";
import { Button } from "../components/Button";
import { AuthField } from "../components/Field";
import { ERROR_NOTE } from "../components/looks";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { Dialog } from "../components/ui/Dialog";
import { Switch } from "../components/ui/Switch";
import { useSettings } from "../data/settings";
import { formatDate, zonedOf } from "../dates";
import { getFeedState, makeFeedLink, turnFeedOff } from "./feed-api";

/**
 * The account menu's "Calendar feed…": a switch that gives the user a
 * private link a phone's calendar app subscribes to (every event of every
 * calendar, read-only, without reminders). The server keeps only a hash of
 * the link, so the link is shown once, right after it is made: on turning
 * the feed on, and on "New link", which ends the old one. Turning it off ends
 * the link too; both ask first.
 */

/** What the dialog shows. `link` is the link just made, the only time there is one. */
export type CalendarFeedView =
  | { kind: "loading" }
  | { kind: "check-failed" }
  | { kind: "ready"; on: boolean; createdAt: string | null; link: string | null };

export const FEED_MESSAGES = {
  loading: "Checking the calendar feed…",
  "check-failed": "Couldn't check the calendar feed. Try again.",
  off: "Off. Turn it on for a private link that a phone's calendar app can subscribe to.",
  what: "It holds every event in all your calendars, read-only and without reminders: Almanac's notifications stay the reminder.",
  shownOnce: "Copy it now. Almanac doesn't keep the link itself, so it can't show it again.",
  lost: "The link was shown once, when it was made. Lost it? Make a new link; the old one stops working.",
  android:
    "On Android, add it in ICSx⁵ (free on F-Droid and Google Play): tap +, paste the link, and pick how often it checks.",
  secret: "Anyone with the link can read your events. Keep it to yourself.",
} as const;

/** "On since 13 Nov 2026." in the display time zone. */
export function sinceText(createdAt: string | null, timeZone: string): string {
  return createdAt === null ? "On." : `On since ${formatDate(zonedOf(createdAt, timeZone))}.`;
}

export interface CalendarFeedPanelProps {
  view: CalendarFeedView;
  timeZone: string;
  busy?: boolean;
  /** A failure, shown as an alert. */
  error?: string | null;
  /** A quieter line: the link was copied. */
  note?: string | null;
  onToggle?: (on: boolean) => void;
  onNewLink?: () => void;
  onCopy?: () => void;
  onRetry?: () => void;
}

/** The dialog's body, without the server: `CalendarFeedDialog` feeds it. */
export function CalendarFeedPanel({
  view,
  timeZone,
  busy = false,
  error = null,
  note = null,
  onToggle,
  onNewLink,
  onCopy,
  onRetry,
}: CalendarFeedPanelProps) {
  const id = useId();
  const labelId = `${id}-label`;
  const stateId = `${id}-state`;
  return (
    <div className="flex flex-col gap-4" aria-busy={view.kind === "loading" || busy}>
      {view.kind === "ready" ? (
        <>
          <div className="flex min-h-(--size-touch) items-center justify-between gap-4">
            <span className="grid min-w-0 gap-0.5">
              <span className="text-body font-medium text-ink" id={labelId}>
                Feed for a calendar app
              </span>
              <span className="text-meta leading-body text-ink-2" id={stateId}>
                {view.on ? sinceText(view.createdAt, timeZone) : FEED_MESSAGES.off}
              </span>
            </span>
            <Switch
              checked={view.on}
              aria-labelledby={labelId}
              aria-describedby={stateId}
              disabled={busy}
              onCheckedChange={(checked) => onToggle?.(checked)}
              data-autofocus=""
            />
          </div>
          <p className="text-meta leading-body text-ink-2">{FEED_MESSAGES.what}</p>
          {view.on && view.link !== null && (
            <div className="flex flex-col gap-3">
              <AuthField
                label="Your private link"
                value={view.link}
                readOnly
                spellCheck={false}
                autoComplete="off"
                onFocus={(event) => event.currentTarget.select()}
                hint={FEED_MESSAGES.shownOnce}
              />
              <div className="flex">
                <Button variant="primary" onClick={onCopy} disabled={busy}>
                  Copy link
                </Button>
              </div>
              <p className="rounded-control bg-accent-tint-soft p-3 text-meta leading-body text-ink">
                {FEED_MESSAGES.android} {FEED_MESSAGES.secret}
              </p>
            </div>
          )}
          {view.on && view.link === null && <p className="text-meta leading-body text-ink-2">{FEED_MESSAGES.lost}</p>}
          {view.on && (
            <div className="flex">
              <Button onClick={onNewLink} disabled={busy}>
                New link
              </Button>
            </div>
          )}
        </>
      ) : (
        <p className="text-meta leading-body text-ink-2">{FEED_MESSAGES[view.kind]}</p>
      )}
      {view.kind === "check-failed" && (
        <div className="flex">
          <Button onClick={onRetry}>Try again</Button>
        </div>
      )}
      {note && (
        <p className="text-meta leading-body text-ink-2" role="status">
          {note}
        </p>
      )}
      {error && (
        <p className={ERROR_NOTE} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

function failureMessage(error: unknown, action: "on" | "new" | "off"): string {
  if (isApiError(error, "network")) return error.message;
  if (isApiError(error, "rate_limited")) return "Too many tries in a row. Wait a minute, then try again.";
  if (action === "off") return "Couldn't turn the calendar feed off. Try again.";
  return action === "on" ? "Couldn't turn the calendar feed on. Try again." : "Couldn't make a new link. Try again.";
}

export interface CalendarFeedDialogProps {
  open: boolean;
  onClose(): void;
}

/** Closed, it renders nothing; each opening asks the server afresh, and a link shown once is gone once it closes. */
export function CalendarFeedDialog({ open, onClose }: CalendarFeedDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Calendar feed"
      size="small"
      footer={
        <Button variant="quiet" onClick={onClose}>
          Done
        </Button>
      }
    >
      {open && <CalendarFeed />}
    </Dialog>
  );
}

function CalendarFeed() {
  const { timeZone } = useSettings();
  const [view, setView] = useState<CalendarFeedView>({ kind: "loading" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [asking, setAsking] = useState<"new" | "off" | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    getFeedState().then(
      ({ on, createdAt }) => {
        if (live) setView({ kind: "ready", on, createdAt, link: null });
      },
      (failure: unknown) => {
        if (live && !isApiError(failure, "signed_out")) setView({ kind: "check-failed" });
      },
    );
    return () => {
      live = false;
    };
  }, [attempt]);

  const start = () => {
    setBusy(true);
    setError(null);
    setNote(null);
  };

  const makeLink = async (action: "on" | "new") => {
    start();
    try {
      const { url, createdAt } = await makeFeedLink();
      setView({ kind: "ready", on: true, createdAt, link: url });
    } catch (failure) {
      if (!isApiError(failure, "signed_out")) setError(failureMessage(failure, action));
    } finally {
      setBusy(false);
    }
  };

  const turnOff = async () => {
    start();
    try {
      await turnFeedOff();
      setView({ kind: "ready", on: false, createdAt: null, link: null });
    } catch (failure) {
      if (!isApiError(failure, "signed_out")) setError(failureMessage(failure, "off"));
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    if (view.kind !== "ready" || view.link === null) return;
    setError(null);
    try {
      await navigator.clipboard.writeText(view.link);
      setNote("Copied.");
    } catch {
      setError("Couldn't copy. Select the link and copy it yourself.");
    }
  };

  return (
    <>
      <CalendarFeedPanel
        view={view}
        timeZone={timeZone}
        busy={busy}
        error={error}
        note={note}
        onToggle={(on) => {
          if (on) void makeLink("on");
          else setAsking("off");
        }}
        onNewLink={() => setAsking("new")}
        onCopy={() => void copy()}
        onRetry={() => {
          setView({ kind: "loading" });
          setAttempt((n) => n + 1);
        }}
      />
      <ConfirmDialog
        open={asking === "new"}
        onClose={() => setAsking(null)}
        title="Make a new link?"
        message={
          <p className="text-body leading-body text-ink">
            The old link stops working at once. A calendar app that uses it stops updating until you give it the new
            one.
          </p>
        }
        confirmLabel="Make a new link"
        pendingLabel="Making…"
        onConfirm={() => makeLink("new")}
      />
      <ConfirmDialog
        open={asking === "off"}
        onClose={() => setAsking(null)}
        title="Turn the calendar feed off?"
        message={
          <p className="text-body leading-body text-ink">
            The link stops working at once, and a calendar app that uses it stops updating. Turning the feed on again
            makes a new link.
          </p>
        }
        confirmLabel="Turn off"
        pendingLabel="Turning off…"
        onConfirm={turnOff}
      />
    </>
  );
}
