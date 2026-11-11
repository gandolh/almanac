import type { Calendar, EditScope, Occurrence } from "@almanac/shared";
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
  type ReactNode,
} from "react";
import { isApiError } from "../api";
import { occurrencePatch } from "../calendar/events";
import { Button } from "../components/Button";
import { Dialog } from "../components/ui/Dialog";
import { BellIcon, CalendarIcon, ClockIcon, NotesIcon, PlaceIcon, RepeatIcon } from "../components/icons";
import { showToast } from "../components/ui/Toast";
import { calendarColor, useCalendars } from "../data/calendars";
import { createEvent, updateEvent } from "../data/occurrences";
import { useSettings } from "../data/settings";
import { deleteOccurrence } from "./delete-occurrence";
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
  reminderOfValue,
  reminderOptions,
  reminderValue,
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
import { cn } from "../lib/cn";
import { CHECK, CHECK_BOX, ERROR, INPUT, NOTES, SELECT_CALENDAR, SELECT_WIDE, TITLE } from "./looks";

/**
 * The event form (glossary: event form), Google's full editor: a dialog,
 * the whole screen on a phone, with the title, when it starts and ends, All
 * day, the reminder, how it repeats, which calendar, where, and notes. Save, Cancel and,
 * when editing, Delete.
 *
 * - A new event starts as `seed` says (the next full hour for an hour when
 *   it says nothing); an edit starts from the occurrence.
 * - A change to the start moves the end with it. An end before the start is
 *   refused under the times, and Save won't go past it.
 * - Saving a series' occurrence asks the edit scope first; when the repeat
 *   changed, "This event" isn't offered. The server's refusals show under
 *   the field they are about, and the form stays open with what was typed.
 *   A delete that fails says so above the buttons too, not in a toast the
 *   dialog would cover.
 * - It opens once the display time zone is known: its fields are wall-clock
 *   times in that zone, drafted once, so drafting them in the default zone
 *   while the settings load would save other instants than were shown.
 *   The settings load with the shell, so the wait is hardly ever seen; if
 *   they fail, the default zone is the zone, as everywhere else.
 * - Backing out of the scope question, or a save or delete that fails, puts
 *   the focus back on the button that started it (it was disabled meanwhile,
 *   so the focus had fallen to the page).
 */
export interface EventFormProps {
  /** A new event: what opened the form. */
  seed?: FormSeed;
  /** An existing occurrence to edit; then `seed` is ignored. */
  occurrence?: Occurrence;
  /** Closes the form: after a save, a delete, or on Cancel and Esc. */
  onClose: () => void;
}

export function EventForm(props: EventFormProps) {
  const { timeZone, status } = useSettings();
  // The zone the form drafts in, once it is known; the form keeps it while it is open.
  const [zone, setZone] = useState(status === "loading" ? null : timeZone);
  if (zone === null && status !== "loading") setZone(timeZone);
  return zone === null ? null : <EventFormDialog {...props} timeZone={zone} />;
}

/** The form itself, for a known display time zone (for tests, which have no settings). */
export function EventFormDialog({ seed, occurrence, onClose, timeZone }: EventFormProps & { timeZone: string }) {
  const { calendars } = useCalendars();
  const [draft, setDraft] = useState<EventDraft>(() =>
    occurrence ? draftOfOccurrence(occurrence, timeZone) : draftOfSeed(seed ?? {}, timeZone),
  );
  const [lastCalendar] = useState(readLastCalendar);
  const [attempted, setAttempted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [deleteFailure, setDeleteFailure] = useState<string | null>(null);
  const formId = useId();
  const whenErrorId = useId();
  const saveId = useId();
  const deleteId = useId();
  const formRef = useRef<HTMLFormElement>(null);

  // The button whose save or delete is under way; it gets the focus back if the form is still open after.
  const busyButton = useRef<string | null>(null);
  useEffect(() => {
    if (busy || busyButton.current === null) return;
    document.getElementById(busyButton.current)?.focus();
    busyButton.current = null;
  }, [busy]);
  // An error above the buttons is scrolled to when it appears: on a phone it can be a screen away.
  const showError = useCallback((node: HTMLElement | null) => node?.scrollIntoView({ block: "nearest" }), []);

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
    setDeleteFailure(null);
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
    busyButton.current = saveId;
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
    setFailure(null);
    setDeleteFailure(null);
    setBusy(true);
    busyButton.current = deleteId;
    const result = await deleteOccurrence(occurrence);
    if (result.outcome === "deleted") {
      showToast("Event deleted");
      onClose();
      return;
    }
    if (result.outcome === "failed") setDeleteFailure(result.message);
    setBusy(false);
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
      footer={
        <>
          {occurrence && (
            <Button id={deleteId} variant="quiet" className="me-auto" onClick={() => void remove()} disabled={busy}>
              Delete
            </Button>
          )}
          <Button variant="quiet" onClick={onClose}>
            Cancel
          </Button>
          <Button id={saveId} type="submit" form={formId} variant="primary" disabled={busy}>
            Save
          </Button>
        </>
      }
    >
      <form id={formId} ref={formRef} className="flex flex-col gap-4" onSubmit={onSubmit} noValidate>
        <input
          type="text"
          className={TITLE}
          aria-label="Title"
          placeholder="Add title"
          value={draft.title}
          maxLength={EVENT_TITLE_MAX}
          autoComplete="off"
          data-autofocus=""
          onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
        />

        <Row icon={<ClockIcon size={ICON} />} label="When">
          <div className="flex flex-wrap items-center gap-2 max-md:grid max-md:grid-cols-[minmax(0,1fr)_var(--width-time-field)]">
            <input
              type="date"
              className={cn(INPUT, DATE, "max-md:col-start-1 max-md:row-start-1")}
              aria-label="Start date"
              aria-invalid={shown.start !== undefined || undefined}
              aria-describedby={whenError ? whenErrorId : undefined}
              value={draft.startDate}
              onChange={(event) => setDraft((current) => withStart(current, { startDate: event.target.value }))}
            />
            {!draft.allDay && (
              <div className="max-md:col-start-2 max-md:row-start-1">
                <TimeField
                  label="Start time"
                  value={draft.startTime}
                  options={startTimeOptions}
                  invalid={shown.start !== undefined}
                  onChange={(startTime) => setDraft((current) => withStart(current, { startTime }))}
                />
              </div>
            )}
            <span className="text-ink-2 max-md:hidden" aria-hidden="true">
              –
            </span>
            {!draft.allDay && (
              <div className="max-md:col-start-2 max-md:row-start-2">
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
              className={cn(INPUT, DATE, "max-md:col-start-1 max-md:row-start-2")}
              aria-label="End date"
              aria-invalid={shown.end !== undefined || undefined}
              aria-describedby={whenError ? whenErrorId : undefined}
              value={draft.endDate}
              onChange={(event) => setDraft((current) => withEnd(current, { endDate: event.target.value }))}
            />
          </div>
          <label className={CHECK}>
            <input
              type="checkbox"
              className={CHECK_BOX}
              checked={draft.allDay}
              onChange={(event) => setDraft((current) => withAllDay(current, event.target.checked))}
            />
            <span>All day</span>
          </label>
          {whenError && (
            <p id={whenErrorId} className={ERROR} role="alert">
              {whenError}
            </p>
          )}
        </Row>

        <Row icon={<BellIcon size={ICON} />} label="Reminder">
          <select
            className={SELECT_WIDE}
            aria-label="Reminder"
            value={reminderValue(draft.reminderMinutes)}
            onChange={(event) =>
              setDraft((current) => ({ ...current, reminderMinutes: reminderOfValue(event.target.value) }))
            }
          >
            {reminderOptions(draft.allDay).map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </Row>

        <Row icon={<RepeatIcon size={ICON} />} label="Repeat">
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

        <Row icon={<CalendarIcon size={ICON} />} label="Calendar">
          <CalendarSelect
            calendars={calendars}
            value={calendarId}
            onChange={(id) => setDraft((current) => ({ ...current, calendarId: id }))}
          />
        </Row>

        <Row icon={<PlaceIcon size={ICON} />} label="Location">
          <input
            type="text"
            className={INPUT}
            aria-label="Location"
            placeholder="Add location"
            value={draft.location}
            maxLength={EVENT_LOCATION_MAX}
            autoComplete="off"
            onChange={(event) => setDraft((current) => ({ ...current, location: event.target.value }))}
          />
        </Row>

        <Row icon={<NotesIcon size={ICON} />} label="Notes">
          <textarea
            className={NOTES}
            aria-label="Notes"
            placeholder="Add notes"
            rows={4}
            value={draft.notes}
            maxLength={EVENT_NOTES_MAX}
            onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))}
          />
        </Row>

        {failure !== null && place === "general" && (
          <p ref={showError} className={cn(ERROR, "ps-editor-lead max-md:ps-9")} role="alert">
            {failure}
          </p>
        )}
        {deleteFailure !== null && (
          <p ref={showError} className={cn(ERROR, "ps-editor-lead max-md:ps-9")} role="alert">
            {deleteFailure}
          </p>
        )}
      </form>
    </Dialog>
  );
}

/** The rows' icons: 20 px, in the column the rows keep for them (44 px, 36 on a phone). */
const ICON = 20;

function Row({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[var(--spacing-editor-lead)_minmax(0,1fr)] items-start max-md:grid-cols-[36px_minmax(0,1fr)]">
      <span className="flex pt-[calc((var(--height-editor-field)-20px)/2)] text-ink-2 max-md:pt-[calc((var(--size-touch)-20px)/2)]">
        {icon}
        <span className="sr-only">{label}</span>
      </span>
      <div className="flex min-w-0 flex-col gap-2">{children}</div>
    </div>
  );
}

// --- The calendar picker (quick create has it too) -------------------------------------------------

/** The date fields beside their times: a fixed width on the desktop, the column on a phone. */
const DATE = "w-date-field max-md:w-full";

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
    <div className="flex min-w-0 items-center gap-2.5">
      <span
        className="size-swatch flex-none rounded-small bg-[var(--calendar-color,var(--color-accent))]"
        style={swatch}
        aria-hidden="true"
      />
      <select
        className={SELECT_CALENDAR}
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
