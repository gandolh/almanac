import { useId, useState } from "react";
import type { Temporal } from "temporal-polyfill";
import { ChevronLeftIcon, ChevronRightIcon } from "../components/icons";
import { MonthGrid } from "../components/MonthGrid";
import { monthTitle } from "../dates";

export interface MiniMonthProps {
  /** The date the main view is on: marked, and the month shown first. */
  date: Temporal.PlainDate;
  today: Temporal.PlainDate;
  /** A day was clicked: the main view moves to it. */
  onPick: (date: Temporal.PlainDate) => void;
}

/**
 * The left column's month, for jumping to a date: its own ‹ › page through
 * months without moving the main view; a click on a day (the next or last
 * month's too) moves the main view there. It opens on the main view's month
 * and follows it (the shell keys it by the date, so a new date starts it
 * afresh).
 */
export function MiniMonth({ date, today, onPick }: MiniMonthProps) {
  const [month, setMonth] = useState(() => date.toPlainYearMonth());
  const titleId = useId();
  return (
    <section className="mini-month" aria-labelledby={titleId}>
      <header className="mini-month__head">
        <h2 id={titleId} className="mini-month__title" aria-live="polite">
          {monthTitle(month)}
        </h2>
        <div className="mini-month__nav">
          <button type="button" className="icon-button icon-button--small" aria-label="Previous month" onClick={() => setMonth(month.subtract({ months: 1 }))}>
            <ChevronLeftIcon size={18} />
          </button>
          <button type="button" className="icon-button icon-button--small" aria-label="Next month" onClick={() => setMonth(month.add({ months: 1 }))}>
            <ChevronRightIcon size={18} />
          </button>
        </div>
      </header>
      <MonthGrid month={month} today={today} selected={date} onPickDay={onPick} size="mini" labelledBy={titleId} />
    </section>
  );
}
