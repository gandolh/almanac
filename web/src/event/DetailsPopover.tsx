import { describeReminder, describeRepeat, type Calendar, type Occurrence } from "@almanac/shared";
import { useId, type CSSProperties, type ReactNode } from "react";
import { displayTitle } from "../calendar/events";
import { CalendarIcon, CloseIcon, DeleteIcon, EditIcon, NotesIcon, PlaceIcon } from "../components/icons";
import { Popover } from "../components/Popover";
import { showToast } from "../components/Toast";
import { calendarColor, useCalendars } from "../data/calendars";
import { useSettings } from "../data/settings";
import { deleteOccurrence } from "./delete-occurrence";
import { useEventEditor } from "./EventEditor";
import { linkify } from "./linkify";
import { whenText } from "./occurrence-text";
import "./details.css";

/**
 * What a click on an event shows, Google's details popover: Edit, Delete
 * and close along the top; the calendar's colour beside the title; when it
 * happens, how it repeats, its reminder (brief 15), where, the notes (links
 * clickable) and which calendar it is on. Esc or a press outside closes it.
 */

/** The popover's icons: 20 px, in the column details.css keeps for them. */
const ICON = 20;

export interface DetailsPopoverProps {
  occurrence: Occurrence;
  /** The event's element in the view (or a rectangle); the popover sits beside it. */
  anchor: Element | DOMRect;
  onClose: () => void;
}

/** The popover; render it to show it. Edit opens the event form; Delete deletes, asking the scope for a series, and says how it went in a toast. */
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
          void deleteOccurrence(occurrence).then((result) => {
            if (result.outcome === "deleted") showToast("Event deleted");
            else if (result.outcome === "failed") showToast(result.message);
          });
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
  const reminder = occurrence.reminderMinutes === null ? null : `Reminder: ${describeReminder(occurrence.reminderMinutes, occurrence.allDay)}`;
  const swatch = calendar ? ({ "--calendar-color": calendarColor(calendar) } as CSSProperties) : undefined;
  return (
    // Focus lands on the details, not on Edit, as Google's popover does.
    <div className="details" tabIndex={-1} data-autofocus="">
      <div className="details__actions">
        <button type="button" className="icon-button" aria-label="Edit event" title="Edit event" onClick={onEdit}>
          <EditIcon size={ICON} />
        </button>
        <button type="button" className="icon-button" aria-label="Delete event" title="Delete event" onClick={onDelete}>
          <DeleteIcon size={ICON} />
        </button>
        <button type="button" className="icon-button" aria-label="Close" title="Close" onClick={onClose}>
          <CloseIcon size={ICON} />
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
          {reminder && <p className="details__repeat">{reminder}</p>}
        </div>
      </div>
      {occurrence.location.trim() !== "" && (
        <DetailRow icon={<PlaceIcon size={ICON} />} label="Location">
          <p className="details__text">{linkify(occurrence.location)}</p>
        </DetailRow>
      )}
      {occurrence.notes.trim() !== "" && (
        <DetailRow icon={<NotesIcon size={ICON} />} label="Notes">
          <p className="details__text details__notes">{linkify(occurrence.notes)}</p>
        </DetailRow>
      )}
      {calendar && (
        <DetailRow icon={<CalendarIcon size={ICON} />} label="Calendar">
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
