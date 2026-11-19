import { useId, useRef, useState, type FormEvent } from "react";
import { useRenameUser, useSession } from "../../vendor/ward/ward-auth-react.js";
import { accountMessage } from "../auth/messages";
// The hook needs the client set up; the session module does that when it loads.
import "../auth/session";
import { Button } from "../components/Button";
import { AuthField } from "../components/Field";
import { Dialog } from "../components/ui/Dialog";

/**
 * The account menu's "Change username": a small dialog with the name in a
 * field. The account keeps its id, its sessions and its calendars; only the
 * name changes. The server refuses a name another user holds, and one that
 * looks like another's (`AIice` against `alice`), both as `username_taken`.
 */
export function ChangeUsernameDialog({ onClose }: { onClose: () => void }) {
  const formId = useId();
  const session = useSession();
  const current = session.status === "signed_in" ? session.user.username : "";
  const rename = useRenameUser();
  const [name, setName] = useState(current);
  const [empty, setEmpty] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (rename.pending) return;
    const next = name.trim();
    if (next === "") {
      setEmpty(true);
      inputRef.current?.focus();
      return;
    }
    if (next === current) {
      onClose();
      return;
    }
    void rename.renameUser(next).then((saved) => {
      if (!saved) inputRef.current?.focus();
    });
  };

  if (rename.done) {
    return (
      <Dialog
        open
        onClose={onClose}
        title="Username changed"
        size="small"
        footer={
          <Button variant="primary" autoFocus onClick={onClose}>
            Done
          </Button>
        }
      >
        <p className="text-body leading-body text-ink-2" role="status">
          You are now {current}. Sign in with that name from now on.
        </p>
      </Dialog>
    );
  }

  const error = empty ? "Enter a username." : rename.error !== null ? accountMessage(rename.error) : undefined;
  return (
    <Dialog
      open
      onClose={onClose}
      title="Change username"
      size="small"
      dismissOnBackdrop={false}
      footer={
        <>
          <Button variant="quiet" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form={formId} variant="primary" disabled={rename.pending}>
            {rename.pending ? "Saving…" : "Change username"}
          </Button>
        </>
      }
    >
      <form id={formId} className="flex flex-col gap-4" onSubmit={submit} noValidate>
        <AuthField
          ref={inputRef}
          label="Username"
          type="text"
          name="username"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          data-autofocus
          value={name}
          error={error}
          onChange={(event) => {
            setName(event.target.value);
            setEmpty(false);
            rename.reset();
          }}
        />
      </form>
    </Dialog>
  );
}
