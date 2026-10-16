// STUB: brief 06 replaces this file with FullCalendar's day, week and month views (same props).
import type { Temporal } from "temporal-polyfill";
import { VIEW_LABELS, rangeTitle, type CalendarView, type View } from "../dates";
import "../styles/stubs.css";

export interface CalendarAreaProps {
  view: CalendarView;
  date: Temporal.PlainDate;
  /** FullCalendar's own navigation (a day number, "+2 more") reports back here; the shell moves the address. */
  onNavigate(view: View, date: Temporal.PlainDate): void;
}

/** Until brief 06: which view and range the address asks for, and nothing else. */
export function CalendarArea({ view, date }: CalendarAreaProps) {
  return (
    <section className="stub-area" aria-label={`${VIEW_LABELS[view]} view`} data-view={view}>
      <p className="stub-area__text">
        {VIEW_LABELS[view]} view, {rangeTitle(view, date)}
      </p>
    </section>
  );
}
