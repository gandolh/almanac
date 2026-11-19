import { useId, useRef, useState, type FormEvent } from "react";
import { useSession } from "../../vendor/ward/ward-auth-react.js";
import { accountMessage } from "../auth/messages";
import { Button } from "../components/Button";
import { AlertIcon, AuthField } from "../components/Field";
import { ERROR_NOTE, ERROR_NOTE_TEXT } from "../components/looks";
import { Dialog } from "../components/ui/Dialog";
import { AccountActionError, linkWard, unlinkWard } from "./actions";

export type WardLinkMode = "link" | "unlink";

/** Words for each mode: the title, what it does, and the button. */
const COPY: Record<WardLinkMode, { title: string; intro: string; button: string; pending: string }> = {
  link: {
    title: "Link Ward",
    intro: "Type your Almanac password to link a Ward account. Ward opens next, so you can sign in with it.",
    button: "Link Ward",
    pending: "Opening Ward…",
  },
  unlink: {
    title: "Unlink Ward",
    intro: "Type your Almanac password to unlink Ward. Your password still signs you in.",
    button: "Unlink Ward",
    pending: "Unlinking…",
  },
};

/** Codes that belong to the password field; any other refusal is the form's. */
const PASSWORD_CODES = new Set(["invalid_credentials", "invalid_request", "too_many_attempts"]);

/**
 * The account menu's "Sign in with Ward" (link or unlink): a small dialog that
 * asks for the account's current password first (Ward's library requires it).
 * A refusal stays here, beside the field, which keeps focus. An account with no
 * password yet is sent to "Change password" instead, as the server would
 * answer `no_local_password` whatever is typed.
 */
export function WardLinkDialog(props: { mode: WardLinkMode; onClose: () => void; onSetPassword: () => void }) {
  const { mode, onClose, onSetPassword } = props;
  const copy = COPY[mode];
  const formId = useId();
  const session = useSession();
  const hasPassword = session.status === "signed_in" ? session.user.hasPassword : true;
  const [password, setPassword] = useState("");
  const [failure, setFailure] = useState<{ code: string; message: string } | null>(null);
  const [pending, setPending] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (pending) return;
    if (password === "") {
      setFailure({ code: "invalid_request", message: accountMessage({ code: "invalid_request" }) });
      inputRef.current?.focus();
      return;
    }
    setPending(true);
    setFailure(null);
    (mode === "link" ? linkWard : unlinkWard)(password).then(
      () => {
        // A link is on its way to Ward (the page leaves); an unlink is done.
        if (mode === "unlink") onClose();
      },
      (error: unknown) => {
        const code = error instanceof AccountActionError ? error.code : "unknown";
        const message = error instanceof Error ? error.message : accountMessage({ code: "unknown" });
        setPending(false);
        setFailure({ code, message });
        if (PASSWORD_CODES.has(code)) {
          setPassword("");
          inputRef.current?.focus();
        }
      },
    );
  };

  const cancel = (
    <Button variant="quiet" onClick={onClose}>
      Cancel
    </Button>
  );

  const fieldError = failure !== null && PASSWORD_CODES.has(failure.code) ? failure.message : undefined;
  const blockError = failure !== null && !PASSWORD_CODES.has(failure.code) ? failure.message : null;

  if (!hasPassword) {
    return (
      <Dialog
        open
        onClose={onClose}
        title={copy.title}
        size="small"
        footer={
          <>
            {cancel}
            <Button variant="primary" data-autofocus onClick={onSetPassword}>
              Set a password
            </Button>
          </>
        }
      >
        <p className="text-body leading-body text-ink-2">{accountMessage({ code: "no_local_password" })}</p>
      </Dialog>
    );
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={copy.title}
      size="small"
      dismissOnBackdrop={false}
      footer={
        <>
          {cancel}
          <Button type="submit" form={formId} variant="primary" disabled={pending}>
            {pending ? copy.pending : copy.button}
          </Button>
        </>
      }
    >
      <form id={formId} className="flex flex-col gap-4" onSubmit={submit} noValidate>
        <p className="text-body leading-body text-ink-2">{copy.intro}</p>
        <input
          className="sr-only"
          type="text"
          name="username"
          autoComplete="username"
          value={session.status === "signed_in" ? session.user.username : ""}
          readOnly
          tabIndex={-1}
          aria-hidden="true"
        />
        <AuthField
          ref={inputRef}
          label="Current password"
          type="password"
          autoComplete="current-password"
          data-autofocus
          value={password}
          error={fieldError}
          onChange={(event) => {
            setPassword(event.target.value);
            if (failure !== null) setFailure(null);
          }}
        />
        {blockError !== null && (
          <p className={ERROR_NOTE} role="alert">
            <AlertIcon />
            <span className={ERROR_NOTE_TEXT}>{blockError}</span>
          </p>
        )}
      </form>
    </Dialog>
  );
}
