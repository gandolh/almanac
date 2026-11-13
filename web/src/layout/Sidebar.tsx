import type { Temporal } from "temporal-polyfill";
import { CalendarList } from "../calendars/CalendarList";
import { PlusIcon } from "../components/icons";
import { dateKey } from "../dates";
import { useEventEditor } from "../event/EventEditor";
import { DayCard } from "./DayCard";
import { MiniMonth } from "./MiniMonth";

export interface SidebarProps {
  /** The date the main view is on. */
  date: Temporal.PlainDate;
  today: Temporal.PlainDate;
  /** A day picked in the mini-month. */
  onPickDate: (date: Temporal.PlainDate) => void;
  /** The day card: on from 768 px; a phone's week has its agenda instead. */
  showDay: boolean;
}

/**
 * The left column: Create, the mini-month card, the My calendars card, then
 * the chosen day's card. 276 px beside the view from 1100 px, scrolling on
 * its own; the drawer's content below that.
 */
export function Sidebar({ date, today, onPickDate, showDay }: SidebarProps) {
  const editor = useEventEditor();
  return (
    <div className="flex flex-col gap-3 px-3 pt-4 pb-6 min-[1100px]:px-0 min-[1100px]:pt-0">
      <button
        type="button"
        className="inline-flex h-create w-full items-center justify-center gap-1.5 rounded-control bg-accent px-4 text-action-large font-semibold text-on-accent transition-[background-color] duration-(--duration-fast) ease-out hover:bg-accent-press hover:text-on-accent active:bg-accent-press"
        onClick={() => editor.openCreate()}
        aria-keyshortcuts="c"
      >
        <PlusIcon size={20} />
        <span>Create</span>
      </button>
      <MiniMonth key={dateKey(date)} date={date} today={today} onPick={onPickDate} />
      <CalendarList />
      {showDay && <DayCard date={date} today={today} />}
    </div>
  );
}
