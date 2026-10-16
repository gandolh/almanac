import { useId, useState, type FormEvent } from "react";
import { isApiError } from "../api";
import { Button } from "../components/Button";
import { CloseIcon } from "../components/icons";
import { Popover } from "../components/Popover";
import { useCalendars } from "../data/calendars";
import { createEvent } from "../data/occurrences";
import { useSettings } from "../data/settings";
import { whenText } from "./DetailsPopover";
import { EVENT_TITLE_MAX, pickCalendar, readLastCalendar, rememberCalendar, titleOf, type FormSeed } from "./editor-state";
import type { QuickCreateInit } from "./EventEditor";
import { CalendarIcon, CalendarSelect, ClockIcon } from "./EventForm";
import "./editor.css";

/**
 * Quick create (glossary: quick create), Google's small popover beside a
 * selection in a view: a title, the time as text, the calendar, Save, and
 * "More options" to carry on in the event form with what was typed.
 *
 * Enter saves (an empty title saves as "(No title)"). Esc, the ✕ and a
 * press outside discard. The caller closes it however it ends, and must
 * let go of the view's selection then (`releaseSelection`).
 */
export interface QuickCreateProps {
  init: QuickCreateInit;
  /** Discarded: Esc, ✕, or a press outside. */
  onClose: () => void;
  /** Saved; the views fetch again by themselves. */
  onSaved: () => void;
  /** "More options": open the event form with this. */
  onMoreOptions: (seed: FormSeed) => void;
}

export function QuickCreate(props: QuickCreateProps) {
  return (
    <Popover anchor={props.init.anchor} onClose={props.onClose} placement="side" label="New event" className="quick-create">
      <QuickCreateForm {...props} />
    </Popover>
  );
}

/** The popover's contents, without the popover (for tests). */
export function QuickCreateForm({ init, onClose, onSaved, onMoreOptions }: QuickCreateProps) {
  const { timeZone } = useSettings();
  const { calendars } = useCalendars();
  const [title, setTitle] = useState("");
  const [chosen, setChosen] = useState<number | null>(null);
  const [lastCalendar] = useState(readLastCalendar);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const failureId = useId();
  const calendarId = chosen ?? pickCalendar(calendars, lastCalendar);

  async function save() {
    if (busy || calendarId === null) return;
    setBusy(true);
    setFailure(null);
    try {
      await createEvent({ calendarId, title: titleOf({ title }), allDay: init.allDay, start: init.start, end: init.end });
      rememberCalendar(calendarId);
      onSaved();
    } catch (error) {
      // Stays open with what was typed.
      setFailure(isApiError(error) ? error.message : "The event couldn't be saved. Try again.");
      setBusy(false);
    }
  }

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    void save();
  };

  return (
    <form className="quick-create__form" onSubmit={onSubmit} noValidate>
      <div className="quick-create__head">
        <button type="button" className="icon-button" aria-label="Close" title="Close" onClick={onClose}>
          <CloseIcon size={20} />
        </button>
      </div>
      <input
        type="text"
        className="editor-title"
        aria-label="Title"
        placeholder="Add title"
        value={title}
        maxLength={EVENT_TITLE_MAX}
        autoComplete="off"
        data-autofocus=""
        onChange={(event) => setTitle(event.target.value)}
      />
      <p className="quick-create__row quick-create__when">
        <span className="quick-create__lead">
          <ClockIcon />
        </span>
        <span>{whenText({ allDay: init.allDay, start: init.start, end: init.end }, timeZone)}</span>
      </p>
      <div className="quick-create__row">
        <span className="quick-create__lead">
          <CalendarIcon />
        </span>
        <CalendarSelect calendars={calendars} value={calendarId} onChange={setChosen} />
      </div>
      {failure !== null && (
        <p id={failureId} className="editor-error" role="alert">
          {failure}
        </p>
      )}
      <div className="quick-create__actions">
        <Button
          variant="quiet"
          onClick={() => onMoreOptions({ start: init.start, end: init.end, allDay: init.allDay, title, calendarId })}
        >
          More options
        </Button>
        <Button type="submit" variant="primary" disabled={busy || calendarId === null}>
          Save
        </Button>
      </div>
    </form>
  );
}
