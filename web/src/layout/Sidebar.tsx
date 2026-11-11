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
    <div className="flex flex-col gap-4 pt-2 pb-6">
      <button
        type="button"
        className="ml-2 inline-flex min-h-create items-center gap-3 self-start rounded-pill bg-surface pr-6 pl-4 text-meta font-medium text-ink shadow-raised transition-[box-shadow,background-color] duration-(--duration-fast) ease-out hover:bg-accent-tint-soft hover:shadow-raised-hover active:bg-accent-tint"
        onClick={() => editor.openCreate()}
        aria-keyshortcuts="c"
      >
        <PlusIcon size={24} className="text-accent" />
        <span>Create</span>
      </button>
      <MiniMonth key={dateKey(date)} date={date} today={today} onPick={onPickDate} />
      <CalendarList />
    </div>
  );
}
