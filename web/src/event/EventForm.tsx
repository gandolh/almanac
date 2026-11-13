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
import { BellIcon, CalendarIcon, ClockIcon, DeleteIcon, NotesIcon, PlaceIcon, RepeatIcon } from "../components/icons";
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
import { CHECK, CHECK_BOX, ERROR, INPUT, LABEL, NOTES, SELECT_CALENDAR, SELECT_WIDE, TITLE } from "./looks";

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
  const titleId = useId();
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
      // Hung from 16 px under the top of the window, as the board draws it, not centred.
      className="md:mt-4 md:mb-auto"
      // A form with typing in it: a stray press on the backdrop must not lose it.
      dismissOnBackdrop={false}
      footer={
        <>
          {occurrence && (
            <Button
              id={deleteId}
              variant="danger"
              className="me-auto"
              icon={<DeleteIcon size={18} />}
              onClick={() => void remove()}
              disabled={busy}
            >
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
      <form id={formId} ref={formRef} className="flex flex-col gap-3" onSubmit={onSubmit} noValidate>
        <div className="flex flex-col gap-1">
          <label className={LABEL} htmlFor={titleId}>
            Title
          </label>
          <input
            id={titleId}
            type="text"
            className={TITLE}
            placeholder="Add title"
            value={draft.title}
            maxLength={EVENT_TITLE_MAX}
            autoComplete="off"
            data-autofocus=""
            onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
          />
        </div>

        <Row icon={<ClockIcon size={ICON} />} label="When" hideLabel>
          <div className="grid grid-cols-2 gap-x-3 gap-y-2 max-md:grid-cols-1">
            <div className="flex min-w-0 flex-col gap-1">
              <span className={LABEL}>Starts</span>
              <div className="grid grid-cols-[minmax(0,1fr)_var(--width-time-field)] gap-2 max-md:grid-cols-[minmax(0,1fr)_112px]">
                <input
                  type="date"
                  className={cn(INPUT, "font-num")}
                  aria-label="Start date"
                  aria-invalid={shown.start !== undefined || undefined}
                  aria-describedby={whenError ? whenErrorId : undefined}
                  value={draft.startDate}
                  onChange={(event) => setDraft((current) => withStart(current, { startDate: event.target.value }))}
                />
                {!draft.allDay && (
                  <TimeField
                    label="Start time"
                    value={draft.startTime}
                    options={startTimeOptions}
                    invalid={shown.start !== undefined}
                    onChange={(startTime) => setDraft((current) => withStart(current, { startTime }))}
                  />
                )}
              </div>
            </div>
            <div className="flex min-w-0 flex-col gap-1">
              <span className={LABEL}>Ends</span>
              <div className="grid grid-cols-[minmax(0,1fr)_var(--width-time-field)] gap-2 max-md:grid-cols-[minmax(0,1fr)_112px]">
                <input
                  type="date"
                  className={cn(INPUT, "font-num")}
                  aria-label="End date"
                  aria-invalid={shown.end !== undefined || undefined}
                  aria-describedby={whenError ? whenErrorId : undefined}
                  value={draft.endDate}
                  onChange={(event) => setDraft((current) => withEnd(current, { endDate: event.target.value }))}
                />
                {!draft.allDay && (
                  <TimeField
                    label="End time"
                    value={draft.endTime}
                    options={() => endTimeOptions(draft)}
                    invalid={shown.end !== undefined}
                    describedBy={whenError ? whenErrorId : undefined}
                    onChange={(endTime) => setDraft((current) => withEnd(current, { endTime }))}
                  />
                )}
              </div>
            </div>
            <label className={cn(CHECK, "col-span-2 max-md:col-span-1")}>
              <input
                type="checkbox"
                className={CHECK_BOX}
                checked={draft.allDay}
                onChange={(event) => setDraft((current) => withAllDay(current, event.target.checked))}
              />
              <span>All day</span>
            </label>
          </div>
          {whenError && (
            <p id={whenErrorId} className={ERROR} role="alert">
              {whenError}
            </p>
          )}
        </Row>

        <div className="grid grid-cols-2 gap-x-3 gap-y-3 max-md:grid-cols-1">
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
        </div>

        <Row icon={<NotesIcon size={ICON} />} label="Notes">
          <textarea
            className={NOTES}
            aria-label="Notes"
            placeholder="Add notes"
            rows={3}
            value={draft.notes}
            maxLength={EVENT_NOTES_MAX}
            onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))}
          />
        </Row>

        {failure !== null && place === "general" && (
          <p ref={showError} className={cn(ERROR, "ps-editor-lead max-md:ps-8")} role="alert">
            {failure}
          </p>
        )}
        {deleteFailure !== null && (
          <p ref={showError} className={cn(ERROR, "ps-editor-lead max-md:ps-8")} role="alert">
            {deleteFailure}
          </p>
        )}
      </form>
    </Dialog>
  );
}

/** The rows' icons: 20 px, in the column the rows keep for them. */
const ICON = 20;

function Row({
  icon,
  label,
  hideLabel = false,
  children,
}: {
  icon: ReactNode;
  label: string;
  /** The row's controls carry their own labels (Starts, Ends): its name is for the screen reader only. */
  hideLabel?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="grid grid-cols-[20px_minmax(0,1fr)] items-start gap-3.5 max-md:gap-3">
      <span className="flex pt-[calc(18px+4px+(var(--height-editor-field)-20px)/2)] text-muted max-md:pt-[calc(18px+4px+(var(--size-touch)-20px)/2)]">
        {icon}
      </span>
      <div className="flex min-w-0 flex-col gap-1">
        <span className={hideLabel ? "sr-only" : LABEL}>{label}</span>
        {children}
      </div>
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
