import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type FormEvent,
  type MouseEvent,
  type ReactNode,
  type SyntheticEvent,
} from "react";
import {
  useChangePassword,
  useSession,
  useSetLocalPassword,
  useWardResult,
  type AuthError,
} from "../../vendor/ward/ward-auth-react.js";
import { AuthField } from "../auth/Field";
import { AlertIcon } from "../auth/icons";
import { accountMessage } from "../auth/messages";
// The hooks below need the client set up; the session module does that when it loads.
import "../auth/session";
import { Button } from "../components/Button";
import { useIsDesktop } from "../components/viewport";
import "../auth/auth.css";
import "./account.css";

/**
 * The account menu's "Change password" (brief 02; brief 05's menu opens it):
 * a modal dialog, so focus stays in the form until it is done or cancelled.
 * On the desktop a white panel in the middle of the window; on a phone a
 * floating sheet over the bottom of the screen.
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
export const MIN_PASSWORD_LENGTH = 8;

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
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const desktop = useIsDesktop();
  const session = useSession();
  const user = session.status === "signed_in" ? session.user : null;
  const hasPassword = user?.hasPassword ?? true;
  const change = useChangePassword();
  const local = useSetLocalPassword();

  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (!dialog.open) dialog.showModal();
    dialog.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    return () => {
      if (dialog.open) dialog.close();
    };
  }, []);

  // A press on the backdrop (which the dialog itself receives) closes it, as the panels do.
  const onClick = (event: MouseEvent<HTMLDialogElement>) => {
    if (event.target === event.currentTarget) onClose();
  };
  const onCancel = (event: SyntheticEvent<HTMLDialogElement>) => {
    event.preventDefault();
    onClose();
  };

  let title = "Change password";
  let body;
  // Either hook: setting a first password refreshes the session, and `hasPassword` is true by the time it is done.
  if (change.done || local.done) {
    title = local.done ? "Password set" : "Password changed";
    body = <Done desktop={desktop} onClose={onClose} />;
  } else if (hasPassword) {
    body = (
      <PasswordForm
        username={user?.username ?? ""}
        needsCurrent
        submitLabel="Change password"
        pending={change.pending}
        failure={change.error}
        desktop={desktop}
        onSubmit={(entry) => change.changePassword(entry.current, entry.next)}
        onEdit={change.reset}
        onCancel={onClose}
      />
    );
  } else if (local.reauthenticated) {
    title = "Set a password";
    body = (
      <PasswordForm
        username={user?.username ?? ""}
        needsCurrent={false}
        intro="Ward confirmed it's you. Choose a password for Almanac, so you can sign in without Ward too."
        submitLabel="Set password"
        pending={local.pending}
        failure={local.error}
        desktop={desktop}
        onSubmit={(entry) => local.setPassword(entry.next)}
        onEdit={local.reset}
        onCancel={onClose}
      />
    );
  } else {
    title = "Set a password";
    body = (
      <ConfirmWithWard
        pending={local.pending}
        failure={local.error}
        desktop={desktop}
        onConfirm={() => void local.reauthenticate()}
        onCancel={onClose}
      />
    );
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      className={desktop ? "password-dialog password-dialog--centered" : "password-dialog password-dialog--sheet"}
      onClick={onClick}
      onCancel={onCancel}
    >
      <div className="password-dialog__frame">
        <h2 id={titleId} className="password-dialog__title">
          {title}
        </h2>
        {body}
      </div>
    </dialog>
  );
}

interface PasswordFormProps {
  /** For password managers: which account the new password belongs to. */
  username: string;
  needsCurrent: boolean;
  intro?: string;
  submitLabel: string;
  pending: boolean;
  failure: AuthError | null;
  desktop: boolean;
  /** Resolves true when the password was saved. */
  onSubmit: (entry: PasswordEntry) => Promise<boolean>;
  /** A field changed: the last failure no longer applies. */
  onEdit: () => void;
  onCancel: () => void;
}

const FIELDS = ["current", "next", "repeat"] as const;

function PasswordForm(props: PasswordFormProps) {
  const { username, needsCurrent, intro, submitLabel, pending, failure, desktop, onSubmit, onEdit, onCancel } = props;
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
    <form className="password-dialog__form" onSubmit={submit} noValidate>
      {intro && <p className="password-dialog__text">{intro}</p>}
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
      <Actions desktop={desktop} onCancel={onCancel}>
        <Button type="submit" variant="primary" size={desktop ? "regular" : "large"} block={!desktop} disabled={pending}>
          {pending ? "Saving…" : submitLabel}
        </Button>
      </Actions>
    </form>
  );
}

function ConfirmWithWard(props: { pending: boolean; failure: AuthError | null; desktop: boolean; onConfirm: () => void; onCancel: () => void }) {
  const { pending, failure, desktop, onConfirm, onCancel } = props;
  return (
    <div className="password-dialog__form">
      <p className="password-dialog__text">
        You sign in with Ward, and Almanac has no password for you yet. Confirm it's you with your Ward password, then choose
        one here, so you can still sign in while Ward is down.
      </p>
      {failure !== null && (
        <p className="auth-error" role="alert">
          <AlertIcon />
          <span className="auth-error__text">{accountMessage(failure)}</span>
        </p>
      )}
      <Actions desktop={desktop} onCancel={onCancel}>
        <Button variant="primary" size={desktop ? "regular" : "large"} block={!desktop} disabled={pending} data-autofocus onClick={onConfirm}>
          {pending ? "Opening Ward…" : "Confirm with Ward"}
        </Button>
      </Actions>
    </div>
  );
}

function Done({ desktop, onClose }: { desktop: boolean; onClose: () => void }) {
  return (
    <div className="password-dialog__form">
      <p className="password-dialog__text" role="status">
        You're still signed in here. Almanac signed you out everywhere else; use the new password there.
      </p>
      <div className="password-dialog__actions">
        <Button variant="primary" size={desktop ? "regular" : "large"} block={!desktop} data-autofocus onClick={onClose}>
          Done
        </Button>
      </div>
    </div>
  );
}

/** Cancel and the action: on the desktop a row on the right, the action last; on a phone the action on top, full width. */
function Actions({ desktop, onCancel, children }: { desktop: boolean; onCancel: () => void; children: ReactNode }) {
  return (
    <div className="password-dialog__actions">
      <Button variant="quiet" size={desktop ? "regular" : "large"} block={!desktop} onClick={onCancel}>
        Cancel
      </Button>
      {children}
    </div>
  );
}
