import { describeRepeat, type Calendar, type Occurrence } from "@almanac/shared";
import { useId, type CSSProperties, type ReactNode, type SVGProps } from "react";
import { isApiError } from "../api";
import { displayTitle } from "../calendar/events";
import { CloseIcon } from "../components/icons";
import { Popover } from "../components/Popover";
import { showToast } from "../components/Toast";
import { calendarColor, useCalendars } from "../data/calendars";
import { deleteEvent, notifyOccurrencesChanged, type DeleteOptions } from "../data/occurrences";
import { useSettings } from "../data/settings";
import { RANGE_DASH, Temporal, formatDayLong, formatTime, zonedOf } from "../dates";
import { useEventEditor } from "./EventEditor";
import { linkify } from "./linkify";
import { askScope } from "./scope";
import "./details.css";

/**
 * What a click on an event shows, Google's details popover: Edit, Delete
 * and close along the top; the calendar's colour beside the title; when it
 * happens, how it repeats, where, the notes (links clickable) and which
 * calendar it is on. Esc or a press outside closes it.
 */

/** " · " between a day and its times. */
const DOT = " · ";

/**
 * When an occurrence happens, in `timeZone`:
 *
 * - "Friday, 16 October · 10:00 – 11:00" (an end at the next midnight counts as the same day);
 * - "Friday, 16 October, 22:00 – Saturday, 17 October, 02:00";
 * - "Friday, 16 October · All day";
 * - "Friday, 16 October – Sunday, 18 October" (all-day over several days; the end date is exclusive).
 */
export function whenText(occurrence: Pick<Occurrence, "allDay" | "start" | "end">, timeZone: string): string {
  if (occurrence.allDay) {
    const first = Temporal.PlainDate.from(occurrence.start);
    const last = Temporal.PlainDate.from(occurrence.end).subtract({ days: 1 });
    if (Temporal.PlainDate.compare(last, first) <= 0) return `${formatDayLong(first)}${DOT}All day`;
    return `${formatDayLong(first)}${RANGE_DASH}${formatDayLong(last)}`;
  }
  const start = zonedOf(occurrence.start, timeZone);
  const end = zonedOf(occurrence.end, timeZone);
  const startDay = start.toPlainDate();
  const endDay = end.toPlainDate();
  const endsAtNextMidnight =
    Temporal.PlainDate.compare(endDay, startDay.add({ days: 1 })) === 0 && end.hour === 0 && end.minute === 0;
  if (Temporal.PlainDate.compare(startDay, endDay) === 0 || endsAtNextMidnight) {
    return `${formatDayLong(startDay)}${DOT}${formatTime(start)}${RANGE_DASH}${formatTime(end)}`;
  }
  return `${formatDayLong(startDay)}, ${formatTime(start)}${RANGE_DASH}${formatDayLong(endDay)}, ${formatTime(end)}`;
}

/**
 * Delete an occurrence the way the details popover does: a series (or one
 * of its exceptions) asks the edit scope first, a one-off goes at once;
 * then "Event deleted", or the error, as a toast. Resolves to whether it
 * was deleted.
 */
export async function deleteOccurrence(occurrence: Occurrence): Promise<boolean> {
  let options: DeleteOptions = {};
  if (occurrence.seriesId !== null) {
    const scope = await askScope({ action: "delete", allowThis: true });
    if (scope === null) return false;
    options = { scope, occurrence: occurrence.originalStart ?? occurrence.start };
  }
  try {
    await deleteEvent(occurrence.eventId, options);
  } catch (error) {
    // Already gone (deleted in another tab): as good as deleted; the views fetch again.
    if (isApiError(error, "not_found")) {
      notifyOccurrencesChanged();
      showToast("Event deleted");
      return true;
    }
    showToast(isApiError(error) ? error.message : "The event couldn't be deleted. Try again.");
    return false;
  }
  showToast("Event deleted");
  return true;
}

export interface DetailsPopoverProps {
  occurrence: Occurrence;
  /** The event's element in the view (or a rectangle); the popover sits beside it. */
  anchor: Element | DOMRect;
  onClose: () => void;
}

/** The popover; render it to show it. Edit opens the event form (brief 07); Delete deletes, asking the scope for a series. */
export function DetailsPopover({ occurrence, anchor, onClose }: DetailsPopoverProps) {
  const { timeZone } = useSettings();
  const { calendars } = useCalendars();
  const editor = useEventEditor();
  const titleId = useId();
  const calendar = calendars.find((each) => each.id === occurrence.calendarId) ?? null;
  return (
    <Popover anchor={anchor} onClose={onClose} placement="side" labelledBy={titleId} className="details-popover">
      <EventDetails
        occurrence={occurrence}
        calendar={calendar}
        timeZone={timeZone}
        titleId={titleId}
        onEdit={() => {
          onClose();
          editor.openEdit(occurrence);
        }}
        onDelete={() => {
          // Google closes the details first; the scope question, if any, comes on its own.
          onClose();
          void deleteOccurrence(occurrence);
        }}
        onClose={onClose}
      />
    </Popover>
  );
}

export interface EventDetailsProps {
  occurrence: Occurrence;
  /** Its calendar, or `null` while the calendars load. */
  calendar: Calendar | null;
  timeZone: string;
  titleId: string;
  onEdit: () => void;
  onDelete: () => void;
  onClose: () => void;
}

/** The popover's contents, without the popover (for tests). */
export function EventDetails({ occurrence, calendar, timeZone, titleId, onEdit, onDelete, onClose }: EventDetailsProps) {
  const repeat = occurrence.repeat ? describeRepeat(occurrence.repeat, occurrence.originalStart ?? occurrence.start, timeZone) : null;
  const swatch = calendar ? ({ "--calendar-color": calendarColor(calendar) } as CSSProperties) : undefined;
  return (
    // Focus lands on the details, not on Edit, as Google's popover does.
    <div className="details" tabIndex={-1} data-autofocus="">
      <div className="details__actions">
        <button type="button" className="icon-button" aria-label="Edit event" title="Edit event" onClick={onEdit}>
          <EditIcon size={20} />
        </button>
        <button type="button" className="icon-button" aria-label="Delete event" title="Delete event" onClick={onDelete}>
          <DeleteIcon size={20} />
        </button>
        <button type="button" className="icon-button" aria-label="Close" title="Close" onClick={onClose}>
          <CloseIcon size={20} />
        </button>
      </div>
      <div className="details__row details__row--head">
        <span className="details__lead">
          <span className="details__swatch" style={swatch} aria-hidden="true" />
        </span>
        <div className="details__body">
          <h2 id={titleId} className="details__title">
            {displayTitle(occurrence.title)}
          </h2>
          <p className="details__when">{whenText(occurrence, timeZone)}</p>
          {repeat && <p className="details__repeat">{repeat}</p>}
        </div>
      </div>
      {occurrence.location.trim() !== "" && (
        <DetailRow icon={<PlaceIcon />} label="Location">
          <p className="details__text">{linkify(occurrence.location)}</p>
        </DetailRow>
      )}
      {occurrence.notes.trim() !== "" && (
        <DetailRow icon={<NotesIcon />} label="Notes">
          <p className="details__text details__notes">{linkify(occurrence.notes)}</p>
        </DetailRow>
      )}
      {calendar && (
        <DetailRow icon={<CalendarIcon />} label="Calendar">
          <p className="details__text">{calendar.name}</p>
        </DetailRow>
      )}
    </div>
  );
}

function DetailRow({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="details__row">
      <span className="details__lead">
        {icon}
        <span className="visually-hidden">{label}</span>
      </span>
      <div className="details__body">{children}</div>
    </div>
  );
}

// --- Icons, in the app's stroke (components/icons.tsx) ------------------------------------------

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

function EditIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 20h4L18.5 9.5a2.1 2.1 0 0 0-3-3L5 17v3" />
      <path d="m13.5 8.5 2 2" />
    </Icon>
  );
}

function DeleteIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4.5 7h15M10 11v6M14 11v6M6.5 7l1 12a1.5 1.5 0 0 0 1.5 1.4h6a1.5 1.5 0 0 0 1.5-1.4l1-12M9.5 7V4.5h5V7" />
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

function CalendarIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="4" y="5" width="16" height="15" rx="2.5" />
      <path d="M4 9.5h16M8.5 3v4M15.5 3v4" />
    </Icon>
  );
}
