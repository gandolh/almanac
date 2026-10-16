import type { Calendar, EditScope, Occurrence } from "@almanac/shared";
import { useId, useRef, useState, type CSSProperties, type FormEvent, type ReactNode, type SVGProps } from "react";
import { isApiError } from "../api";
import { occurrencePatch } from "../calendar/events";
import { Button } from "../components/Button";
import { Dialog } from "../components/Dialog";
import { calendarColor, useCalendars } from "../data/calendars";
import { createEvent, updateEvent } from "../data/occurrences";
import { useSettings } from "../data/settings";
import { deleteOccurrence } from "./DetailsPopover";
import {
  EVENT_LOCATION_MAX,
  EVENT_NOTES_MAX,
  EVENT_TITLE_MAX,
  changedFields,
  draftOfOccurrence,
  draftOfSeed,
  endTimeOptions,
  errorPlace,
  eventInputOf,
  hasProblems,
  pickCalendar,
  problemsOf,
  readLastCalendar,
  rememberCalendar,
  repeatLabelDate,
  repeatSummary,
  scopeQuestion,
  startTimeOptions,
  wireTimesOf,
  withAllDay,
  withEnd,
  withStart,
  type DraftProblems,
  type EventDraft,
  type FormSeed,
} from "./editor-state";
import { RepeatPicker } from "./RepeatPicker";
import { askScope } from "./scope";
import { TimeField } from "./TimeField";
import "./editor.css";

/**
 * The event form (glossary: event form), Google's full editor: a dialog,
 * the whole screen on a phone, with the title, when it starts and ends, All
 * day, how it repeats, which calendar, where, and notes. Save, Cancel and,
 * when editing, Delete.
 *
 * - A new event starts as `seed` says (the next full hour for an hour when
 *   it says nothing); an edit starts from the occurrence.
 * - A change to the start moves the end with it. An end before the start is
 *   refused under the times, and Save won't go past it.
 * - Saving a series' occurrence asks the edit scope first; when the repeat
 *   changed, "This event" isn't offered. The server's refusals show under
 *   the field they are about, and the form stays open with what was typed.
 */
export interface EventFormProps {
  /** A new event: what opened the form. */
  seed?: FormSeed;
  /** An existing occurrence to edit; then `seed` is ignored. */
  occurrence?: Occurrence;
  /** Closes the form: after a save, a delete, or on Cancel and Esc. */
  onClose: () => void;
}

export function EventForm({ seed, occurrence, onClose }: EventFormProps) {
  const { timeZone } = useSettings();
  const { calendars } = useCalendars();
  const [draft, setDraft] = useState<EventDraft>(() => (occurrence ? draftOfOccurrence(occurrence, timeZone) : draftOfSeed(seed ?? {}, timeZone)));
  const [lastCalendar] = useState(readLastCalendar);
  const [attempted, setAttempted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const formId = useId();
  const whenErrorId = useId();
  const formRef = useRef<HTMLFormElement>(null);

  const calendarId = draft.calendarId ?? pickCalendar(calendars, lastCalendar);
  const problems = problemsOf(draft);
  // Typing a date passes through gaps; the order of the times is the one thing said while typing.
  const timesKnown = wireTimesOf(draft, timeZone) !== null;
  const shown: DraftProblems = attempted ? problems : { end: timesKnown ? problems.end : undefined };
  const place = failure === null ? null : errorPlace(failure);
  const whenError = shown.start ?? shown.end ?? (place === "when" ? (failure ?? undefined) : undefined);
  const repeatError = shown.repeat ?? (place === "repeat" ? (failure ?? undefined) : undefined);

  async function save() {
    setFailure(null);
    setAttempted(true);
    if (hasProblems(problems)) {
      // The fields mark themselves invalid on the next render; then the first one gets the focus.
      requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
      return;
    }
    if (calendarId === null) {
      setFailure("Your calendars are still loading. Try again in a moment.");
      return;
    }
    setBusy(true);
    try {
      let remember = occurrence === undefined;
      if (occurrence === undefined) {
        const input = eventInputOf(draft, calendarId, timeZone);
        if (input === null) {
          setBusy(false);
          return;
        }
        await createEvent(input);
      } else {
        const changes = changedFields({ ...draft, calendarId }, occurrence, timeZone);
        if (changes === null) {
          setBusy(false);
          return;
        }
        remember = changes.calendarId !== undefined;
        if (Object.keys(changes).length > 0) {
          let scope: EditScope | null = null;
          if (occurrence.seriesId !== null) {
            scope = await askScope(scopeQuestion(changes));
            // Backed out: the form stays as it is.
            if (scope === null) {
              setBusy(false);
              return;
            }
          }
          await updateEvent(occurrence.eventId, occurrencePatch(occurrence, changes, scope));
        }
      }
      if (remember) rememberCalendar(calendarId);
      onClose();
    } catch (error) {
      setFailure(isApiError(error) ? error.message : "The event couldn't be saved. Try again.");
      setBusy(false);
    }
  }

  async function remove() {
    if (occurrence === undefined || busy) return;
    setBusy(true);
    const deleted = await deleteOccurrence(occurrence);
    if (deleted) onClose();
    else setBusy(false);
  }

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!busy) void save();
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title={occurrence ? "Edit event" : "New event"}
      size="large"
      // A form with typing in it: a stray press on the backdrop must not lose it.
      dismissOnBackdrop={false}
      className="event-form-dialog"
      footer={
        <>
          {occurrence && (
            <Button variant="quiet" className="event-form__delete" onClick={() => void remove()} disabled={busy}>
              Delete
            </Button>
          )}
          <Button variant="quiet" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form={formId} variant="primary" disabled={busy}>
            Save
          </Button>
        </>
      }
    >
      <form id={formId} ref={formRef} className="event-form" onSubmit={onSubmit} noValidate>
        <input
          type="text"
          className="editor-title"
          aria-label="Title"
          placeholder="Add title"
          value={draft.title}
          maxLength={EVENT_TITLE_MAX}
          autoComplete="off"
          data-autofocus=""
          onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
        />

        <Row icon={<ClockIcon />} label="When">
          <div className="editor-when">
            <input
              type="date"
              className="editor-input editor-date editor-when__start-date"
              aria-label="Start date"
              aria-invalid={shown.start !== undefined || undefined}
              aria-describedby={whenError ? whenErrorId : undefined}
              value={draft.startDate}
              onChange={(event) => setDraft((current) => withStart(current, { startDate: event.target.value }))}
            />
            {!draft.allDay && (
              <div className="editor-when__start-time">
                <TimeField
                  label="Start time"
                  value={draft.startTime}
                  options={startTimeOptions}
                  invalid={shown.start !== undefined}
                  onChange={(startTime) => setDraft((current) => withStart(current, { startTime }))}
                />
              </div>
            )}
            <span className="editor-when__dash" aria-hidden="true">
              –
            </span>
            {!draft.allDay && (
              <div className="editor-when__end-time">
                <TimeField
                  label="End time"
                  value={draft.endTime}
                  options={() => endTimeOptions(draft)}
                  invalid={shown.end !== undefined}
                  describedBy={whenError ? whenErrorId : undefined}
                  onChange={(endTime) => setDraft((current) => withEnd(current, { endTime }))}
                />
              </div>
            )}
            <input
              type="date"
              className="editor-input editor-date editor-when__end-date"
              aria-label="End date"
              aria-invalid={shown.end !== undefined || undefined}
              aria-describedby={whenError ? whenErrorId : undefined}
              value={draft.endDate}
              onChange={(event) => setDraft((current) => withEnd(current, { endDate: event.target.value }))}
            />
          </div>
          <label className="editor-check">
            <input type="checkbox" checked={draft.allDay} onChange={(event) => setDraft((current) => withAllDay(current, event.target.checked))} />
            <span>All day</span>
          </label>
          {whenError && (
            <p id={whenErrorId} className="editor-error" role="alert">
              {whenError}
            </p>
          )}
        </Row>

        <Row icon={<RepeatIcon />} label="Repeat">
          <RepeatPicker
            repeat={draft.repeat}
            labelDate={repeatLabelDate(draft)}
            startDate={draft.startDate}
            timeZone={timeZone}
            summary={repeatSummary(draft, timeZone)}
            error={repeatError}
            onChange={(repeat) => setDraft((current) => ({ ...current, repeat, repeatTouched: true }))}
          />
        </Row>

        <Row icon={<CalendarIcon />} label="Calendar">
          <CalendarSelect calendars={calendars} value={calendarId} onChange={(id) => setDraft((current) => ({ ...current, calendarId: id }))} />
        </Row>

        <Row icon={<PlaceIcon />} label="Location">
          <input
            type="text"
            className="editor-input"
            aria-label="Location"
            placeholder="Add location"
            value={draft.location}
            maxLength={EVENT_LOCATION_MAX}
            autoComplete="off"
            onChange={(event) => setDraft((current) => ({ ...current, location: event.target.value }))}
          />
        </Row>

        <Row icon={<NotesIcon />} label="Notes">
          <textarea
            className="editor-input editor-notes"
            aria-label="Notes"
            placeholder="Add notes"
            rows={4}
            value={draft.notes}
            maxLength={EVENT_NOTES_MAX}
            onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))}
          />
        </Row>

        {failure !== null && place === "general" && (
          <p className="editor-error editor-error--form" role="alert">
            {failure}
          </p>
        )}
      </form>
    </Dialog>
  );
}

function Row({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="editor-row">
      <span className="editor-row__lead">
        {icon}
        <span className="visually-hidden">{label}</span>
      </span>
      <div className="editor-row__body">{children}</div>
    </div>
  );
}

// --- The calendar picker (quick create has it too) -------------------------------------------------

export interface CalendarSelectProps {
  calendars: readonly Calendar[];
  /** The chosen calendar's id; `null` while the calendars load. */
  value: number | null;
  onChange: (id: number) => void;
  label?: string;
}

/** A calendar's colour square beside a list of the user's calendars. */
export function CalendarSelect({ calendars, value, onChange, label = "Calendar" }: CalendarSelectProps) {
  const current = calendars.find((calendar) => calendar.id === value);
  const swatch = current ? ({ "--calendar-color": calendarColor(current) } as CSSProperties) : undefined;
  return (
    <div className="calendar-select">
      <span className="calendar-select__swatch" style={swatch} aria-hidden="true" />
      <select
        className="editor-input editor-select"
        aria-label={label}
        value={value ?? ""}
        disabled={calendars.length === 0}
        onChange={(event) => onChange(Number(event.target.value))}
      >
        {calendars.length === 0 && <option value="">Loading…</option>}
        {calendars.map((calendar) => (
          <option key={calendar.id} value={calendar.id}>
            {calendar.name}
          </option>
        ))}
      </select>
    </div>
  );
}

// --- Icons, in the app's stroke (as the details popover's) -----------------------------------------------

type IconProps = Omit<SVGProps<SVGSVGElement>, "children"> & { size?: number };

function Icon({ size = 20, children, ...rest }: IconProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  );
}

export function ClockIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </Icon>
  );
}

function RepeatIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4.5 11V9.5a3 3 0 0 1 3-3H18M15 3.5l3 3-3 3M19.5 13v1.5a3 3 0 0 1-3 3H6M9 20.5l-3-3 3-3" />
    </Icon>
  );
}

export function CalendarIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="4" y="5" width="16" height="15" rx="2.5" />
      <path d="M4 9.5h16M8.5 3v4M15.5 3v4" />
    </Icon>
  );
}

function PlaceIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z" />
      <circle cx="12" cy="10" r="2.3" />
    </Icon>
  );
}

function NotesIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M5 6.5h14M5 11h14M5 15.5h9" />
    </Icon>
  );
}
