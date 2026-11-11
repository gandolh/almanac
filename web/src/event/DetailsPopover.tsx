import { describeReminder, describeRepeat, type Calendar, type Occurrence } from "@almanac/shared";
import { useId, type CSSProperties, type ReactNode } from "react";
import { displayTitle } from "../calendar/events";
import { CalendarIcon, CloseIcon, DeleteIcon, EditIcon, NotesIcon, PlaceIcon } from "../components/icons";
import { Popover } from "../components/ui/Popover";
import { showToast } from "../components/ui/Toast";
import { calendarColor, useCalendars } from "../data/calendars";
import { useSettings } from "../data/settings";
import { deleteOccurrence } from "./delete-occurrence";
import { useEventEditor } from "./EventEditor";
import { linkify } from "./linkify";
import { whenText } from "./occurrence-text";
import { ICON_BUTTON } from "../components/looks";

/**
 * What a click on an event shows, Google's details popover: Edit, Delete
 * and close along the top; the calendar's colour beside the title; when it
 * happens, how it repeats, its reminder, where, the notes (links
 * clickable) and which calendar it is on. Esc or a press outside closes it.
 */

/** The popover's icons: 20 px, in the 52 px column the rows keep for them. */
const ICON = 20;

/** A row: the icon (or the calendar's colour square) in a fixed column, the text beside it. */
const ROW_CLASS = "grid grid-cols-[52px_minmax(0,1fr)] items-start pe-5 text-ink-2";
/** Links in a location or in notes underline a little further out than the page's default. */
const TEXT_CLASS = "text-meta leading-body wrap-anywhere text-ink [&_a]:underline-offset-2";

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
    <Popover anchor={anchor} onClose={onClose} placement="side" labelledBy={titleId} className="w-(--width-popover)">
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
            else if (result.outcome === "failed") showToast(result.message, { type: "error" });
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
export function EventDetails({
  occurrence,
  calendar,
  timeZone,
  titleId,
  onEdit,
  onDelete,
  onClose,
}: EventDetailsProps) {
  const repeat = occurrence.repeat
    ? describeRepeat(occurrence.repeat, occurrence.originalStart ?? occurrence.start, timeZone)
    : null;
  const reminder =
    occurrence.reminderMinutes === null
      ? null
      : `Reminder: ${describeReminder(occurrence.reminderMinutes, occurrence.allDay)}`;
  const swatch = calendar ? ({ "--calendar-color": calendarColor(calendar) } as CSSProperties) : undefined;
  return (
    // Focus lands on the details, not on Edit, as Google's popover does.
    <div className="flex flex-col gap-3 px-2 pt-2 pb-5 focus:outline-none" tabIndex={-1} data-autofocus="">
      <div className="flex justify-end gap-0.5">
        <button type="button" className={ICON_BUTTON} aria-label="Edit event" title="Edit event" onClick={onEdit}>
          <EditIcon size={ICON} />
        </button>
        <button type="button" className={ICON_BUTTON} aria-label="Delete event" title="Delete event" onClick={onDelete}>
          <DeleteIcon size={ICON} />
        </button>
        <button type="button" className={ICON_BUTTON} aria-label="Close" title="Close" onClick={onClose}>
          <CloseIcon size={ICON} />
        </button>
      </div>
      <div className={ROW_CLASS}>
        <span className="flex justify-center pt-[7px]">
          <span
            className="size-swatch rounded-small bg-[var(--calendar-color,var(--color-accent))]"
            style={swatch}
            aria-hidden="true"
          />
        </span>
        <div className="min-w-0">
          <h2 id={titleId} className="text-range leading-[1.3] font-regular wrap-anywhere text-ink">
            {displayTitle(occurrence.title)}
          </h2>
          <p className="mt-1 text-meta leading-body text-ink">{whenText(occurrence, timeZone)}</p>
          {repeat && <p className="text-meta leading-body">{repeat}</p>}
          {reminder && <p className="text-meta leading-body">{reminder}</p>}
        </div>
      </div>
      {occurrence.location.trim() !== "" && (
        <DetailRow icon={<PlaceIcon size={ICON} />} label="Location">
          <p className={TEXT_CLASS}>{linkify(occurrence.location)}</p>
        </DetailRow>
      )}
      {occurrence.notes.trim() !== "" && (
        <DetailRow icon={<NotesIcon size={ICON} />} label="Notes">
          <p className={`${TEXT_CLASS} whitespace-pre-wrap`}>{linkify(occurrence.notes)}</p>
        </DetailRow>
      )}
      {calendar && (
        <DetailRow icon={<CalendarIcon size={ICON} />} label="Calendar">
          <p className={TEXT_CLASS}>{calendar.name}</p>
        </DetailRow>
      )}
    </div>
  );
}

function DetailRow({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className={ROW_CLASS}>
      <span className="flex justify-center pt-px">
        {icon}
        <span className="sr-only">{label}</span>
      </span>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
