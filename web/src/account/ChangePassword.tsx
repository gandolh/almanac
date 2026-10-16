import { useEffect, useId, useRef, useState, useSyncExternalStore, type FormEvent } from "react";
import {
  useChangePassword,
  useSession,
  useSetLocalPassword,
  useWardResult,
  type AuthError,
} from "../../vendor/ward/ward-auth-react.js";
import { accountMessage } from "../auth/messages";
// The hooks below need the client set up; the session module does that when it loads.
import "../auth/session";
import { Button } from "../components/Button";
import { Dialog } from "../components/Dialog";
import { AlertIcon, AuthField } from "../components/Field";
import "./account.css";

/**
 * The account menu's "Change password" (brief 02; brief 05's menu opens it):
 * a small `components/Dialog`, so focus stays in the form until it is done or
 * cancelled.
 *
 * - With a password: the current one, the new one twice. Every other session
 *   ends; this one stays.
 * - Without one (a user made by "Sign in with Ward"): Ward confirms it's them
 *   first (Ward asks for the Ward password even when signed in there), then
 *   the new password twice. The round trip comes back to home with
 *   `?ward=reauthenticated`, and the dialog opens itself again on that.
 */

// --- Open and closed, from outside React -------------------------------------------

let open = false;
let returnFocus: HTMLElement | null = null;
const listeners = new Set<() => void>();

function setOpen(next: boolean): void {
  if (next === open) return;
  open = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Show the dialog (the account menu's action). Focus goes back to what had it, the account button, on close. */
export function openChangePassword(): void {
  if (open) return;
  returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  setOpen(true);
}

// --- Checking the new password before it is sent ----------------------------------

/** The library's rule (MIN_PASSWORD_LENGTH); the server checks it again. */
const MIN_PASSWORD_LENGTH = 8;

export interface PasswordEntry {
  current: string;
  next: string;
  repeat: string;
}

export type PasswordProblems = Partial<Record<keyof PasswordEntry, string>>;

/** What is wrong with the entry, field by field; empty when it can be sent. `current` is only asked for when the user has a password. */
export function checkPasswords(entry: PasswordEntry, needsCurrent: boolean): PasswordProblems {
  const problems: PasswordProblems = {};
  if (needsCurrent && entry.current === "") problems.current = "Enter your current password.";
  if (entry.next.length < MIN_PASSWORD_LENGTH) problems.next = `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  else if (entry.repeat !== entry.next) problems.repeat = "The new passwords don't match.";
  return problems;
}

// --- The dialog --------------------------------------------------------------------

/** Mount once inside the auth gate (`App.tsx`). Renders nothing while closed. */
export function ChangePasswordDialog() {
  const isOpen = useSyncExternalStore(subscribe, () => open, () => false);
  const { result, clear } = useWardResult();
  const confirmed = result === "reauthenticated";

  // Back from confirming with Ward: carry on where the dialog left off.
  useEffect(() => {
    if (confirmed) setOpen(true);
  }, [confirmed]);

  if (!isOpen) return null;
  return (
    <PasswordDialog
      onClose={() => {
        setOpen(false);
        if (confirmed) clear();
        if (returnFocus?.isConnected) returnFocus.focus();
        returnFocus = null;
      }}
    />
  );
}

function PasswordDialog({ onClose }: { onClose: () => void }) {
  const formId = useId();
  const session = useSession();
  const user = session.status === "signed_in" ? session.user : null;
  const hasPassword = user?.hasPassword ?? true;
  const change = useChangePassword();
  const local = useSetLocalPassword();

  const cancel = (
    <Button variant="quiet" onClick={onClose}>
      Cancel
    </Button>
  );
  const submit = (label: string, pending: boolean) => (
    <Button type="submit" form={formId} variant="primary" disabled={pending}>
      {pending ? "Saving…" : label}
    </Button>
  );

  let title = "Change password";
  let body;
  let footer;
  // Either hook: setting a first password refreshes the session, and `hasPassword` is true by the time it is done.
  if (change.done || local.done) {
    title = local.done ? "Password set" : "Password changed";
    body = (
      <p className="password-text" role="status">
        You're still signed in here. Almanac signed you out everywhere else; use the new password there.
      </p>
    );
    footer = (
      <Button variant="primary" autoFocus onClick={onClose}>
        Done
      </Button>
    );
  } else if (hasPassword) {
    body = (
      <PasswordForm
        id={formId}
        username={user?.username ?? ""}
        needsCurrent
        failure={change.error}
        onSubmit={(entry) => change.changePassword(entry.current, entry.next)}
        onEdit={change.reset}
        pending={change.pending}
      />
    );
    footer = (
      <>
        {cancel}
        {submit("Change password", change.pending)}
      </>
    );
  } else if (local.reauthenticated) {
    title = "Set a password";
    body = (
      <PasswordForm
        id={formId}
        username={user?.username ?? ""}
        needsCurrent={false}
        intro="Ward confirmed it's you. Choose a password for Almanac, so you can sign in without Ward too."
        failure={local.error}
        onSubmit={(entry) => local.setPassword(entry.next)}
        onEdit={local.reset}
        pending={local.pending}
      />
    );
    footer = (
      <>
        {cancel}
        {submit("Set password", local.pending)}
      </>
    );
  } else {
    title = "Set a password";
    body = <ConfirmWithWard failure={local.error} />;
    footer = (
      <>
        {cancel}
        <Button variant="primary" disabled={local.pending} data-autofocus onClick={() => void local.reauthenticate()}>
          {local.pending ? "Opening Ward…" : "Confirm with Ward"}
        </Button>
      </>
    );
  }

  return (
    <Dialog open onClose={onClose} title={title} size="small" dismissOnBackdrop={false} footer={footer}>
      {body}
    </Dialog>
  );
}

interface PasswordFormProps {
  /** The form's id, so the dialog footer's button can submit it. */
  id: string;
  /** For password managers: which account the new password belongs to. */
  username: string;
  needsCurrent: boolean;
  intro?: string;
  pending: boolean;
  failure: AuthError | null;
  /** Resolves true when the password was saved. */
  onSubmit: (entry: PasswordEntry) => Promise<boolean>;
  /** A field changed: the last failure no longer applies. */
  onEdit: () => void;
}

const FIELDS = ["current", "next", "repeat"] as const;

function PasswordForm(props: PasswordFormProps) {
  const { id, username, needsCurrent, intro, pending, failure, onSubmit, onEdit } = props;
  const [entry, setEntry] = useState<PasswordEntry>({ current: "", next: "", repeat: "" });
  const [problems, setProblems] = useState<PasswordProblems>({});
  const currentRef = useRef<HTMLInputElement>(null);
  const nextRef = useRef<HTMLInputElement>(null);
  const repeatRef = useRef<HTMLInputElement>(null);

  const update = (key: keyof PasswordEntry) => (event: { target: { value: string } }) => {
    setEntry((value) => ({ ...value, [key]: event.target.value }));
    if (problems[key]) setProblems((value) => ({ ...value, [key]: undefined }));
    onEdit();
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (pending) return;
    const found = checkPasswords(entry, needsCurrent);
    setProblems(found);
    const first = FIELDS.find((key) => found[key] !== undefined);
    if (first !== undefined) {
      ({ current: currentRef, next: nextRef, repeat: repeatRef })[first].current?.focus();
      return;
    }
    void onSubmit(entry).then((saved) => {
      // Refused: the current password goes, for another go at it (it is the usual culprit).
      if (saved || !needsCurrent) return;
      setEntry((value) => ({ ...value, current: "" }));
      currentRef.current?.focus();
    });
  };

  // A wrong current password is that field's problem; anything else is the form's.
  const wrongCurrent = failure?.code === "invalid_credentials";
  const currentError = problems.current ?? (failure !== null && wrongCurrent ? accountMessage(failure) : undefined);
  const blockFailure = failure !== null && !wrongCurrent ? accountMessage(failure) : null;

  return (
    <form id={id} className="password-form" onSubmit={submit} noValidate>
      {intro && <p className="password-text">{intro}</p>}
      <input className="visually-hidden" type="text" name="username" autoComplete="username" value={username} readOnly tabIndex={-1} aria-hidden="true" />
      {needsCurrent && (
        <AuthField
          ref={currentRef}
          label="Current password"
          type="password"
          autoComplete="current-password"
          data-autofocus
          value={entry.current}
          error={currentError}
          onChange={update("current")}
        />
      )}
      <AuthField
        ref={nextRef}
        label="New password"
        type="password"
        autoComplete="new-password"
        data-autofocus={needsCurrent ? undefined : true}
        value={entry.next}
        error={problems.next}
        hint={`At least ${MIN_PASSWORD_LENGTH} characters.`}
        onChange={update("next")}
      />
      <AuthField
        ref={repeatRef}
        label="New password, again"
        type="password"
        autoComplete="new-password"
        value={entry.repeat}
        error={problems.repeat}
        onChange={update("repeat")}
      />
      {blockFailure !== null && (
        <p className="auth-error" role="alert">
          <AlertIcon />
          <span className="auth-error__text">{blockFailure}</span>
        </p>
      )}
    </form>
  );
}

function ConfirmWithWard({ failure }: { failure: AuthError | null }) {
  return (
    <div className="password-form">
      <p className="password-text">
        You sign in with Ward, and Almanac has no password for you yet. Confirm it's you with your Ward password, then choose
        one here, so you can still sign in while Ward is down.
      </p>
      {failure !== null && (
        <p className="auth-error" role="alert">
          <AlertIcon />
          <span className="auth-error__text">{accountMessage(failure)}</span>
        </p>
      )}
    </div>
  );
}
