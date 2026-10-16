import { CALENDAR_NAME_MAX, nextCalendarColor, type Calendar, type CalendarColor, type CalendarCreate } from "@almanac/shared";
import { useId, useState, type FormEvent } from "react";
import { isApiError } from "../api";
import { AuthField } from "../auth/Field";
import { Button } from "../components/Button";
import { Dialog } from "../components/Dialog";
import { PlusIcon } from "../components/icons";
import { showToast } from "../components/Toast";
import { useCalendars } from "../data/calendars";
import { notifyOccurrencesChanged } from "../data/occurrences";
import { CalendarRow, checkCalendarName, LAST_CALENDAR_REASON } from "./CalendarRow";
import { ColorPicker } from "./ColorPicker";
import "../auth/auth.css";
import "./calendars.css";

/** The words for a failed call: the connection's own when there is none, else `fallback`. */
function reason(error: unknown, fallback: string): string {
  return isApiError(error, "network") ? error.message : fallback;
}

/**
 * The left column's "My calendars" (corpus/wiki/features.md "Calendars"):
 * each calendar with its show/hide checkbox and a ⋮ menu to rename, recolour
 * or delete it, and a "+" to make a new one. Every change shows at once
 * (data/calendars.ts) and is undone, with a toast, when the server refuses.
 */
export function CalendarList() {
  const { calendars, status, create, update, remove, refresh } = useCalendars();
  const [creating, setCreating] = useState(false);
  const headingId = useId();

  const change = (calendar: Calendar, patch: Parameters<typeof update>[1], failure: string) => {
    update(calendar.id, patch).catch((error: unknown) => showToast(reason(error, failure)));
  };

  const deleteCalendar = async (calendar: Calendar) => {
    try {
      await remove(calendar.id);
      // Its events went with it: views showing them fetch again.
      notifyOccurrencesChanged();
      showToast(`"${calendar.name}" deleted`);
    } catch (error) {
      // The server refuses the last calendar (409 conflict): the same words as the disabled Delete.
      const isLast = isApiError(error) && (error.code === "conflict" || error.status === 409);
      showToast(isLast ? LAST_CALENDAR_REASON : reason(error, "Couldn't delete the calendar. Try again."));
    }
  };

  return (
    <section className="calendar-list" aria-labelledby={headingId} aria-busy={status === "loading" || undefined}>
      <header className="calendar-list__head">
        <h2 id={headingId} className="calendar-list__title">
          My calendars
        </h2>
        <button type="button" className="icon-button icon-button--small" aria-label="Create new calendar" onClick={() => setCreating(true)}>
          <PlusIcon size={20} />
        </button>
      </header>
      {status === "error" && (
        <div className="calendar-list__note" role="status">
          <span>Your calendars couldn't be loaded.</span>
          <Button variant="quiet" size="compact" onClick={() => void refresh()}>
            Try again
          </Button>
        </div>
      )}
      <ul className="calendar-list__rows">
        {calendars.map((calendar) => (
          <CalendarRow
            key={calendar.id}
            calendar={calendar}
            isOnly={calendars.length === 1}
            onVisibleChange={(visible) => change(calendar, { visible }, `Couldn't ${visible ? "show" : "hide"} "${calendar.name}". Try again.`)}
            onRename={(name) => change(calendar, { name }, "Couldn't rename the calendar. Try again.")}
            onRecolor={(color) => change(calendar, { color }, "Couldn't change the colour. Try again.")}
            onDelete={() => deleteCalendar(calendar)}
          />
        ))}
      </ul>
      {creating && (
        <NewCalendarDialog
          usedColors={calendars.map((calendar) => calendar.color)}
          onCreate={async (body) => {
            await create(body);
          }}
          onClose={() => setCreating(false)}
        />
      )}
    </section>
  );
}

interface NewCalendarDialogProps {
  /** The colours the user's calendars already have: the form starts on the next one. */
  usedColors: readonly CalendarColor[];
  onCreate: (body: CalendarCreate) => Promise<void>;
  onClose: () => void;
}

/** "+": a name and a colour. Mounted means open, so each opening starts fresh. */
function NewCalendarDialog({ usedColors, onCreate, onClose }: NewCalendarDialogProps) {
  const formId = useId();
  const [name, setName] = useState("");
  const [color, setColor] = useState<CalendarColor>(() => nextCalendarColor(usedColors));
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (saving) return;
    const checked = checkCalendarName(name);
    if (!checked.ok) return setError(checked.error);
    setSaving(true);
    try {
      await onCreate({ name: checked.name, color, visible: true });
      onClose();
    } catch (failure) {
      setError(reason(failure, "Couldn't create the calendar. Try again."));
      setSaving(false);
    }
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title="New calendar"
      size="small"
      dismissOnBackdrop={false}
      footer={
        <>
          <Button variant="quiet" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form={formId} disabled={saving}>
            Create
          </Button>
        </>
      }
    >
      <form id={formId} className="calendar-form" onSubmit={(event) => void submit(event)} noValidate>
        <AuthField
          label="Name"
          value={name}
          onChange={(event) => {
            setName(event.target.value);
            setError(undefined);
          }}
          maxLength={CALENDAR_NAME_MAX}
          error={error}
          autoComplete="off"
          data-autofocus=""
        />
        <div className="calendar-form__group">
          <span className="calendar-form__label" aria-hidden="true">
            Colour
          </span>
          <ColorPicker value={color} onChange={setColor} label="Colour" />
        </div>
      </form>
    </Dialog>
  );
}
