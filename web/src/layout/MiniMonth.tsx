import { useId, useState } from "react";
import type { Temporal } from "temporal-polyfill";
import { ChevronLeftIcon, ChevronRightIcon } from "../components/icons";
import { MonthGrid } from "../components/MonthGrid";
import { monthTitle } from "../dates";
import { ICON_BUTTON_SMALL } from "../components/looks";

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
    <section className="flex flex-col gap-1 px-4" aria-labelledby={titleId}>
      <header className="flex items-center justify-between pl-1">
        <h2 id={titleId} className="text-meta leading-tight font-medium text-ink" aria-live="polite">
          {monthTitle(month)}
        </h2>
        <div className="flex gap-1">
          <button
            type="button"
            className={ICON_BUTTON_SMALL}
            aria-label="Previous month"
            onClick={() => setMonth(month.subtract({ months: 1 }))}
          >
            <ChevronLeftIcon size={18} />
          </button>
          <button
            type="button"
            className={ICON_BUTTON_SMALL}
            aria-label="Next month"
            onClick={() => setMonth(month.add({ months: 1 }))}
          >
            <ChevronRightIcon size={18} />
          </button>
        </div>
      </header>
      <MonthGrid month={month} today={today} selected={date} onPickDay={onPick} size="mini" labelledBy={titleId} />
    </section>
  );
}
