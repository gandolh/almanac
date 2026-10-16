// STUB: brief 08 replaces this file with the year view (same props): the dots, the day list, the layout.
import { useId } from "react";
import { Temporal } from "temporal-polyfill";
import { MonthGrid } from "../components/MonthGrid";
import { monthName } from "../dates";
import { useToday } from "../data/settings";
import "../styles/stubs.css";

export interface YearViewProps {
  year: number;
  /** A day was chosen: the shell opens the day view on it. */
  onOpenDay(date: Temporal.PlainDate): void;
  /** A month's name was chosen: the shell opens the month view on its 1st. */
  onOpenMonth(date: Temporal.PlainDate): void;
}

/** Until brief 08: the twelve months, without events. */
export function YearView({ year, onOpenDay, onOpenMonth }: YearViewProps) {
  const today = useToday();
  return (
    <section className="stub-year" aria-label={`Year ${year}`}>
      {Array.from({ length: 12 }, (_, index) => (
        <StubMonth key={index} month={Temporal.PlainYearMonth.from({ year, month: index + 1 })} today={today} onOpenDay={onOpenDay} onOpenMonth={onOpenMonth} />
      ))}
    </section>
  );
}

function StubMonth(props: { month: Temporal.PlainYearMonth; today: Temporal.PlainDate } & Omit<YearViewProps, "year">) {
  const { month, today, onOpenDay, onOpenMonth } = props;
  const titleId = useId();
  return (
    <div className="stub-year__month">
      <button type="button" id={titleId} className="stub-year__title" onClick={() => onOpenMonth(month.toPlainDate({ day: 1 }))}>
        {monthName(month.month)}
      </button>
      <MonthGrid month={month} today={today} onPickDay={onOpenDay} size="year" labelledBy={titleId} />
    </div>
  );
}
