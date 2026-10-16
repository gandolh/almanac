import type { Temporal } from "temporal-polyfill";
import { CalendarList } from "../calendars/CalendarList";
import { PlusIcon } from "../components/icons";
import { dateKey } from "../dates";
import { useEventEditor } from "../event/EventEditor";
import { MiniMonth } from "./MiniMonth";

export interface SidebarProps {
  /** The date the main view is on. */
  date: Temporal.PlainDate;
  today: Temporal.PlainDate;
  /** A day picked in the mini-month. */
  onPickDate: (date: Temporal.PlainDate) => void;
}

/**
 * The left column, Google's: the Create button, the mini-month, then the
 * calendars. 256 px beside the views on the desktop; the drawer's content on
 * a phone.
 */
export function Sidebar({ date, today, onPickDate }: SidebarProps) {
  const editor = useEventEditor();
  return (
    <div className="sidebar">
      <button type="button" className="create-button" onClick={() => editor.openCreate()} aria-keyshortcuts="c">
        <PlusIcon size={24} className="create-button__icon" />
        <span>Create</span>
      </button>
      <MiniMonth key={dateKey(date)} date={date} today={today} onPick={onPickDate} />
      <CalendarList />
    </div>
  );
}
