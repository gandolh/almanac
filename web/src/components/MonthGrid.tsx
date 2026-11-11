import { useRef, useState, type KeyboardEvent } from "react";
import type { Temporal } from "temporal-polyfill";
import { cn } from "../lib/cn";
import { WEEKDAY_INITIALS, WEEKDAY_NAMES, dateKey, formatDayFull, monthWeeks, sameDate } from "../dates";

/**
 * One month as a small grid of days, Monday first, six weeks tall so every
 * month is the same height: the left column's mini-month (`size: "mini"`)
 * and each of the year view's twelve (`size: "year"`).
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

/** The cell and the day circle are variables, so a container query in the year view can resize them. */
const GRID: Record<MonthGridProps["size"], string> = {
  mini: "w-[calc(var(--cell)*7)] text-mini [--cell:var(--size-mini-cell)] [--day:var(--size-mini-day)]",
  year: "w-[calc(var(--cell)*7)] text-label @max-[472px]/year:text-meta [--cell:var(--size-year-cell)] [--day:var(--size-year-day)]",
};

const cellClass = (size: MonthGridProps["size"]) =>
  size === "year" ? "h-[calc(var(--day)+2px)] w-(--cell) p-0 text-center" : "h-(--day) w-(--cell) p-0 text-center";

const DAY_CLASS = [
  "group relative inline-flex size-(--day) items-center justify-center rounded-pill bg-transparent p-0 leading-none font-medium text-ink",
  "transition-[background-color] duration-(--duration-fast) ease-out hover:bg-hover focus-visible:outline-offset-0",
  // Another month's day, in the mini-month.
  "data-outside:font-regular data-outside:text-muted",
  // The date the main view is on: a light accent circle.
  "data-selected:bg-accent-tint data-selected:text-accent-ink data-selected:hover:bg-accent-tint",
  // Today: the filled accent circle, everywhere.
  "data-today:bg-accent data-today:text-on-accent data-today:hover:bg-accent-press",
].join(" ");

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
  const stopKey =
    focused !== null && allDays.some((date) => dateKey(date) === focused && pickable(date))
      ? focused
      : dateKey(defaultStop);

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, date: Temporal.PlainDate) => {
    const step = STEPS[event.key];
    if (step === undefined || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    event.preventDefault();
    const next = dateKey(date.add({ days: step }));
    tableRef.current?.querySelector<HTMLButtonElement>(`button[data-date="${next}"]`)?.focus();
  };

  return (
    <table
      ref={tableRef}
      className={cn("table-fixed border-collapse tabular-nums", GRID[size])}
      data-size={size}
      aria-labelledby={labelledBy}
    >
      <thead>
        <tr>
          {WEEKDAY_INITIALS.map((initial, index) => (
            <th
              key={index}
              scope="col"
              abbr={WEEKDAY_NAMES[index]}
              className="h-(--day) w-(--cell) p-0 text-center font-medium text-ink-2"
            >
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
              if (!pickable(date)) return <td key={key} className={cellClass(size)} />;
              const isToday = sameDate(date, today);
              const isSelected = selected !== undefined && sameDate(date, selected);
              const hasEvents = marked?.has(key) ?? false;
              return (
                <td key={key} className={cellClass(size)}>
                  <button
                    type="button"
                    className={DAY_CLASS}
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
                    {hasEvents && (
                      <span
                        className="absolute bottom-0.5 left-1/2 size-day-dot -translate-x-1/2 rounded-pill bg-accent group-data-today:bg-on-accent"
                        aria-hidden="true"
                      />
                    )}
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
