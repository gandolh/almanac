import type { EditScope } from "@almanac/shared";
import { useId, useState } from "react";
import { createRoot } from "react-dom/client";
import { Button } from "../components/Button";
import { Dialog } from "../components/Dialog";
import "./details.css";

/**
 * The edit-scope question (glossary: edit scope), Google's "Edit recurring
 * event" dialog: three radio buttons, Cancel and OK. Anything can ask it
 * with `askScope` (the event form, a drag in a view, a delete); the dialog
 * mounts in a React root of its own, so the caller needs no component in its
 * tree. What each answer does to the stored rows is
 * corpus/wiki/recurrence.md's "Edit scopes".
 */

export interface AskScopeOptions {
  /** "Edit recurring event" or "Delete recurring event". */
  action: "edit" | "delete";
  /** False when "This event" can't apply, as for a change to the repeat rule: only the two broader scopes are offered. */
  allowThis: boolean;
}

export const SCOPE_LABELS: Readonly<Record<EditScope, string>> = {
  this: "This event",
  following: "This and following events",
  all: "All events",
};

/** The scopes offered, in Google's order; the first is chosen to begin with. */
export function scopeChoices(allowThis: boolean): EditScope[] {
  return allowThis ? ["this", "following", "all"] : ["following", "all"];
}

/**
 * The dialog's title, in Google's words. The glossary keeps "recurring event"
 * out of code and docs, and the UI otherwise says "Repeats"; these two titles
 * keep Google's wording on purpose.
 */
export function scopeTitle(action: AskScopeOptions["action"]): string {
  return action === "edit" ? "Edit recurring event" : "Delete recurring event";
}

export interface ScopeDialogProps extends AskScopeOptions {
  /** The chosen scope on OK; `null` on Cancel, Esc, ✕ or a press on the backdrop. */
  onDone: (scope: EditScope | null) => void;
}

/** The dialog itself; `askScope` mounts it. */
export function ScopeDialog({ action, allowThis, onDone }: ScopeDialogProps) {
  const choices = scopeChoices(allowThis);
  const [chosen, setChosen] = useState<EditScope>(choices[0] ?? "all");
  const formId = useId();
  const name = useId();
  return (
    <Dialog
      open
      onClose={() => onDone(null)}
      title={scopeTitle(action)}
      size="small"
      footer={
        <>
          <Button variant="quiet" onClick={() => onDone(null)}>
            Cancel
          </Button>
          <Button type="submit" form={formId} variant="primary">
            OK
          </Button>
        </>
      }
    >
      <form
        id={formId}
        onSubmit={(event) => {
          event.preventDefault();
          onDone(chosen);
        }}
      >
        <fieldset className="scope-choices">
          <legend className="visually-hidden">Apply to</legend>
          {choices.map((scope) => (
            <label key={scope} className="scope-choice">
              <input
                type="radio"
                name={name}
                value={scope}
                checked={chosen === scope}
                onChange={() => setChosen(scope)}
                data-autofocus={chosen === scope ? "" : undefined}
              />
              <span>{SCOPE_LABELS[scope]}</span>
            </label>
          ))}
        </fieldset>
      </form>
    </Dialog>
  );
}

let pending: ((scope: EditScope | null) => void) | null = null;

/**
 * Ask which occurrences an edit or delete of a series applies to. Resolves
 * to the scope chosen, or `null` when the user backs out (then change
 * nothing, and put back whatever moved). Asking again while a question is
 * open answers the first one `null`.
 */
export function askScope(options: AskScopeOptions): Promise<EditScope | null> {
  pending?.(null);
  return new Promise((resolve) => {
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    let settled = false;
    const done = (scope: EditScope | null) => {
      if (settled) return;
      settled = true;
      if (pending === done) pending = null;
      resolve(scope);
      // After the click that answered has finished with this root.
      queueMicrotask(() => {
        root.unmount();
        host.remove();
      });
    };
    pending = done;
    root.render(<ScopeDialog action={options.action} allowThis={options.allowThis} onDone={done} />);
  });
}
