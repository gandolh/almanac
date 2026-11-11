import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { isApiError } from "../api";
import { Button } from "../components/Button";
import { CalendarIcon, ClockIcon, CloseIcon } from "../components/icons";
import { Popover } from "../components/ui/Popover";
import { useCalendars } from "../data/calendars";
import { createEvent } from "../data/occurrences";
import { useSettings } from "../data/settings";
import type { QuickCreateInit } from "./editor-session";
import {
  EVENT_TITLE_MAX,
  pickCalendar,
  readLastCalendar,
  rememberCalendar,
  titleOf,
  type FormSeed,
} from "./editor-state";
import { CalendarSelect } from "./EventForm";
import { whenText } from "./occurrence-text";
import { ICON_BUTTON } from "../components/looks";
import { ERROR, TITLE } from "./looks";

/**
 * Quick create (glossary: quick create), Google's small popover beside a
 * selection in a view: a title, the time as text, the calendar, Save, and
 * "More options" to carry on in the event form with what was typed.
 *
 * Enter saves (an empty title saves as "(No title)"). Esc, the ✕ and a
 * press outside discard. The caller closes it however it ends, and must
 * let go of the view's selection then (`releaseSelection`). A new `init`
 * for the same span (its selection pressed again) keeps what was typed and
 * puts the focus back in the title.
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

/** Quick create's icons: 20 px, in the 20 px column the rows keep for them. */
const ICON = 20;

const ROW_CLASS = "m-0 flex items-center gap-3 text-meta leading-body text-ink";
const LEAD_CLASS = "flex w-5 flex-none justify-center text-ink-2";

export function QuickCreate(props: QuickCreateProps) {
  return (
    <Popover
      anchor={props.init.anchor}
      onClose={props.onClose}
      placement="side"
      label="New event"
      className="w-(--width-popover)"
    >
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
  const titleRef = useRef<HTMLInputElement>(null);
  const calendarId = chosen ?? pickCalendar(calendars, lastCalendar);

  // The popover puts the focus in the title when it opens; a press on the selection since may have taken it.
  const initShown = useRef(init);
  useEffect(() => {
    if (initShown.current === init) return;
    initShown.current = init;
    titleRef.current?.focus({ preventScroll: true });
  }, [init]);

  async function save() {
    if (busy || calendarId === null) return;
    setBusy(true);
    setFailure(null);
    try {
      await createEvent({
        calendarId,
        title: titleOf({ title }),
        allDay: init.allDay,
        start: init.start,
        end: init.end,
      });
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
    <form className="flex flex-col gap-3 px-5 pt-1 pb-4" onSubmit={onSubmit} noValidate>
      <div className="-mx-3 flex justify-end">
        <button type="button" className={ICON_BUTTON} aria-label="Close" title="Close" onClick={onClose}>
          <CloseIcon size={ICON} />
        </button>
      </div>
      <input
        ref={titleRef}
        type="text"
        className={TITLE}
        aria-label="Title"
        placeholder="Add title"
        value={title}
        maxLength={EVENT_TITLE_MAX}
        autoComplete="off"
        data-autofocus=""
        onChange={(event) => setTitle(event.target.value)}
      />
      <p className={ROW_CLASS}>
        <span className={LEAD_CLASS}>
          <ClockIcon size={ICON} />
        </span>
        <span>{whenText({ allDay: init.allDay, start: init.start, end: init.end }, timeZone)}</span>
      </p>
      <div className={ROW_CLASS}>
        <span className={LEAD_CLASS}>
          <CalendarIcon size={ICON} />
        </span>
        <CalendarSelect calendars={calendars} value={calendarId} onChange={setChosen} />
      </div>
      {failure !== null && (
        <p id={failureId} className={ERROR} role="alert">
          {failure}
        </p>
      )}
      <div className="flex items-center justify-end gap-2">
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
