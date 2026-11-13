import { describeReminder, describeRepeat, type Calendar, type Occurrence } from "@almanac/shared";
import { useId, type CSSProperties, type ReactNode } from "react";
import { displayTitle } from "../calendar/events";
import { BellIcon, CalendarIcon, CloseIcon, DeleteIcon, EditIcon, NotesIcon, PlaceIcon } from "../components/icons";
import { Button } from "../components/Button";
import { Sheet } from "../components/ui/Sheet";
import { useIsDesktop } from "../components/viewport";
import { cn } from "../lib/cn";
import { Popover } from "../components/ui/Popover";
import { showToast } from "../components/ui/Toast";
import { calendarColor, useCalendars } from "../data/calendars";
import { useSettings } from "../data/settings";
import { deleteOccurrence } from "./delete-occurrence";
import { useEventEditor } from "./EventEditor";
import { linkify } from "./linkify";
import { whenLines } from "./occurrence-text";
import { ICON_BUTTON } from "../components/looks";

/**
 * What a click on an event shows: its calendar's mark beside the title and
 * a close button; the date, then the time on its own line, and how it
 * repeats; its reminder, location, notes (links clickable) and calendar as
 * labelled rows; then Delete (a danger button) and Edit (outlined). Esc or a
 * press outside closes it. On the desktop it is a popover beside the event;
 * on a phone the same card is a bottom sheet with 48 px buttons.
 */

/** The details' icons: 20 px, in the 32 px column the rows keep for them. */
const ICON = 20;

/** A row of the details: the icon in a fixed column, a small label over the value. */
const ROW_CLASS = "grid grid-cols-[20px_minmax(0,1fr)] items-start gap-3 text-muted";
/** Links in a location or in notes underline a little further out than the page's default. */
const TEXT_CLASS = "text-body leading-5 wrap-anywhere text-ink [&_a]:underline-offset-2";

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
  const desktop = useIsDesktop();
  const calendar = calendars.find((each) => each.id === occurrence.calendarId) ?? null;
  const details = (
    <EventDetails
      occurrence={occurrence}
      calendar={calendar}
      timeZone={timeZone}
      titleId={titleId}
      phone={!desktop}
      onEdit={() => {
        onClose();
        editor.openEdit(occurrence);
      }}
      onDelete={() => {
        // The details close first; the scope question, if any, comes on its own.
        onClose();
        void deleteOccurrence(occurrence).then((result) => {
          if (result.outcome === "deleted") showToast("Event deleted");
          else if (result.outcome === "failed") showToast(result.message, { type: "error" });
        });
      }}
      onClose={onClose}
    />
  );
  if (!desktop) {
    return (
      <Sheet onClose={onClose} labelledBy={titleId}>
        {details}
      </Sheet>
    );
  }
  return (
    <Popover anchor={anchor} onClose={onClose} placement="side" labelledBy={titleId} className="w-(--width-popover)">
      {details}
    </Popover>
  );
}

export interface EventDetailsProps {
  occurrence: Occurrence;
  /** Its calendar, or `null` while the calendars load. */
  calendar: Calendar | null;
  timeZone: string;
  titleId: string;
  /** The phone's sheet: 48 px buttons. */
  phone?: boolean;
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
  phone = false,
  onEdit,
  onDelete,
  onClose,
}: EventDetailsProps) {
  const repeat = occurrence.repeat
    ? describeRepeat(occurrence.repeat, occurrence.originalStart ?? occurrence.start, timeZone)
    : null;
  const reminder =
    occurrence.reminderMinutes === null ? null : describeReminder(occurrence.reminderMinutes, occurrence.allDay);
  const when = whenLines(occurrence, timeZone);
  const swatch = calendar ? ({ "--calendar-color": calendarColor(calendar) } as CSSProperties) : undefined;
  return (
    // Focus lands on the details, not on a button.
    <div className="flex flex-col gap-3 pt-2 pb-1 focus:outline-none md:p-4 md:pb-3" tabIndex={-1} data-autofocus="">
      <div className="flex items-center gap-2.5">
        <span
          className="size-3.5 flex-none rounded-small bg-[var(--calendar-color,var(--color-accent))]"
          style={swatch}
          aria-hidden="true"
        />
        <h2 id={titleId} className="min-w-0 flex-1 text-range leading-7 font-semibold wrap-anywhere text-ink">
          {displayTitle(occurrence.title)}
        </h2>
        <button type="button" className={ICON_BUTTON} aria-label="Close" title="Close" onClick={onClose}>
          <CloseIcon size={ICON} />
        </button>
      </div>
      <div className="-mt-1.5 pl-6">
        <p className="text-action-large leading-[22px] font-semibold text-ink">{when.date}</p>
        {when.time && <p className="font-num text-action-large leading-[22px] font-medium text-muted">{when.time}</p>}
        {repeat && <p className="text-body leading-5 text-ink-2">{repeat}</p>}
      </div>
      {reminder && (
        <DetailRow icon={<BellIcon size={ICON} />} label="Reminder">
          <p className={TEXT_CLASS}>{reminder}</p>
        </DetailRow>
      )}
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
      <div className="mt-1 flex items-center gap-2 border-t border-hairline pt-2.5">
        <Button
          variant="danger"
          className={cn("me-auto", phone && "min-h-12")}
          aria-label="Delete event"
          title="Delete event"
          icon={<DeleteIcon size={18} />}
          onClick={onDelete}
        >
          Delete
        </Button>
        <Button
          variant="quiet"
          className={cn(phone && "min-h-12 px-[18px]")}
          aria-label="Edit event"
          title="Edit event"
          icon={<EditIcon size={18} />}
          onClick={onEdit}
        >
          Edit
        </Button>
      </div>
    </div>
  );
}

function DetailRow({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className={ROW_CLASS}>
      <span className="flex pt-0.5">{icon}</span>
      <div className="min-w-0">
        <p className="text-label leading-4 font-medium text-muted">{label}</p>
        {children}
      </div>
    </div>
  );
}
