import { useRef, useState, type KeyboardEvent } from "react";
import type { Temporal } from "temporal-polyfill";
import { WEEKDAY_INITIALS, WEEKDAY_NAMES, dateKey, formatDayFull, monthWeeks, sameDate } from "../dates";

/**
 * One month as a small grid of days, Monday first, six weeks tall so every
 * month is the same height: the left column's mini-month (`size: "mini"`)
 * and each of the year view's twelve (`size: "year"`, brief 08).
 *
 * - Today is a filled accent circle; `selected` (the date the main view is
 *   on) a light accent one.
 * - `marked` holds `YYYY-MM-DD` keys (`dateKey`): a dot under the number,
 *   for days with events.
 * - `mini` shows the days of the months either side, muted, and they can be
 *   picked; `year` leaves those cells empty, so no day shows twice on the
 *   year view's page.
 * - Each day is a button; one of them is in the tab order (the selected
 *   day, else today, else the 1st) and the arrow keys move between them.
 *
 * The caller draws the month's name; pass its id as `labelledBy`.
 */
export interface MonthGridProps {
  month: Temporal.PlainYearMonth;
  today: Temporal.PlainDate;
  selected?: Temporal.PlainDate;
  marked?: ReadonlySet<string>;
  onPickDay: (date: Temporal.PlainDate) => void;
  size: "mini" | "year";
  labelledBy?: string;
}

const STEPS: Readonly<Record<string, number>> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };

export function MonthGrid({ month, today, selected, marked, onPickDay, size, labelledBy }: MonthGridProps) {
  const tableRef = useRef<HTMLTableElement>(null);
  const [focused, setFocused] = useState<string | null>(null);
  const weeks = monthWeeks(month);
  const inMonth = (date: Temporal.PlainDate) => date.month === month.month && date.year === month.year;
  const pickable = (date: Temporal.PlainDate) => size === "mini" || inMonth(date);

  const allDays = weeks.flat();
  const defaultStop =
    (selected && inMonth(selected) && selected) || (inMonth(today) && today) || month.toPlainDate({ day: 1 });
  const stopKey = focused !== null && allDays.some((date) => dateKey(date) === focused && pickable(date)) ? focused : dateKey(defaultStop);

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, date: Temporal.PlainDate) => {
    const step = STEPS[event.key];
    if (step === undefined || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    event.preventDefault();
    const next = dateKey(date.add({ days: step }));
    tableRef.current?.querySelector<HTMLButtonElement>(`button[data-date="${next}"]`)?.focus();
  };

  return (
    <table ref={tableRef} className={`month-grid month-grid--${size}`} aria-labelledby={labelledBy}>
      <thead>
        <tr>
          {WEEKDAY_INITIALS.map((initial, index) => (
            <th key={index} scope="col" abbr={WEEKDAY_NAMES[index]} className="month-grid__weekday">
              {initial}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {weeks.map((week) => (
          <tr key={dateKey(week[0] ?? today)}>
            {week.map((date) => {
              const key = dateKey(date);
              if (!pickable(date)) return <td key={key} className="month-grid__cell" />;
              const isToday = sameDate(date, today);
              const isSelected = selected !== undefined && sameDate(date, selected);
              const hasEvents = marked?.has(key) ?? false;
              return (
                <td key={key} className="month-grid__cell">
                  <button
                    type="button"
                    className="month-grid__day"
                    data-date={key}
                    data-today={isToday || undefined}
                    data-selected={(isSelected && !isToday) || undefined}
                    data-outside={!inMonth(date) || undefined}
                    data-marked={hasEvents || undefined}
                    aria-current={isToday ? "date" : undefined}
                    aria-pressed={selected === undefined ? undefined : isSelected}
                    aria-label={hasEvents ? `${formatDayFull(date)}, has events` : formatDayFull(date)}
                    tabIndex={key === stopKey ? 0 : -1}
                    onFocus={() => setFocused(key)}
                    onKeyDown={(event) => onKeyDown(event, date)}
                    onClick={() => onPickDay(date)}
                  >
                    <span>{date.day}</span>
                    {hasEvents && <span className="month-grid__dot" aria-hidden="true" />}
                  </button>
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
