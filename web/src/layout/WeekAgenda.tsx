import type { Occurrence } from "@almanac/shared";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Button } from "../components/Button";
import { calendarColor, useCalendars } from "../data/calendars";
import { useOccurrenceSpan, useWallClock } from "../data/occurrence-span";
import { useSettings } from "../data/settings";
import {
  WEEKDAY_SHORT,
  dateKey,
  datesOf,
  formatDayFull,
  formatDayLong,
  sameDate,
  visibleRange,
  type Temporal,
  type View,
} from "../dates";
import { DetailsPopover } from "../event/DetailsPopover";
import { occurrencesOn } from "../year/days";
import { DayRows } from "./DayRows";

export interface WeekAgendaProps {
  /** The date the week view is on: the chosen day. */
  date: Temporal.PlainDate;
  today: Temporal.PlainDate;
  /** A chip was tapped: the week view on that day. */
  onNavigate: (view: View, date: Temporal.PlainDate) => void;
}

/** The most ticks a chip draws; the rest are in the agenda below. */
const TICKS_MAX = 6;

/**
 * The phone's week: a sticky strip of seven day chips (the weekday, the date
 * and a tick in the calendar's colour for each event), and under it one card
 * per day of the week, so the screen answers "what's on this week" without a
 * tap. The chosen day is the address's date; tapping a chip moves the address
 * to that day and the agenda scrolls to its card. A row opens the event's
 * details as a bottom sheet. The time grid stays in the Day view.
 */
export function WeekAgenda({ date, today, onNavigate }: WeekAgendaProps) {
  const { timeZone } = useSettings();
  const { calendars } = useCalendars();
  const span = visibleRange("week", date);
  const days = datesOf(span);
  const { occurrences, status, retry } = useOccurrenceSpan(span, timeZone);
  const now = useWallClock(timeZone);
  const [details, setDetails] = useState<{ occurrence: Occurrence; anchor: Element } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  const scrolled = useRef<string | null>(null);

  // The agenda opens on the chosen day, and again when the answer arrives (days above it grow then).
  const chosenKey = dateKey(date);
  useEffect(() => {
    const stamp = `${chosenKey}/${status === "ready" ? "ready" : "wait"}`;
    if (scrolled.current === stamp || scrolled.current === `${chosenKey}/ready`) return;
    scrolled.current = stamp;
    const card = rootRef.current?.querySelector<HTMLElement>(`[data-day="${chosenKey}"]`);
    const scroller = rootRef.current?.closest("main");
    if (!card || !scroller) return;
    const strip = stripRef.current?.offsetHeight ?? 0;
    scroller.scrollTo({ top: card.offsetTop - strip - 8, behavior: "instant" });
  }, [chosenKey, status]);

  const byDay = days.map((day) => occurrencesOn(day, occurrences, calendars, timeZone));
  const colors = new Map(calendars.map((calendar) => [calendar.id, calendarColor(calendar)]));

  return (
    <div ref={rootRef} className="relative flex flex-col" aria-label="Week view" role="region" data-view="week">
      <div ref={stripRef} className="sticky top-0 z-10 bg-ground px-2 pt-2 pb-1">
        <div
          className="flex gap-0.5 rounded-card border border-hairline bg-surface px-1 pt-1.5 pb-2 shadow-card"
          role="group"
          aria-label="Days of the week"
        >
          {days.map((day, index) => {
            const chosen = sameDate(day, date);
            const events = byDay[index] ?? [];
            return (
              <button
                key={dateKey(day)}
                type="button"
                className="group flex min-h-[76px] min-w-0 flex-1 flex-col items-center gap-1.5 bg-transparent p-0"
                aria-pressed={chosen}
                aria-label={`${formatDayFull(day)}, ${events.length === 0 ? "no events" : `${events.length} ${events.length === 1 ? "event" : "events"}`}`}
                onClick={() => onNavigate("week", day)}
              >
                <span
                  className="flex h-[54px] w-full flex-col items-center justify-center rounded-control group-aria-pressed:bg-accent"
                  data-today={sameDate(day, today) || undefined}
                >
                  <span className="text-label leading-4 font-medium text-muted group-aria-pressed:text-on-accent">
                    {WEEKDAY_SHORT[index]}
                  </span>
                  <span className="font-num text-day-number-phone leading-[26px] font-semibold text-ink group-aria-pressed:font-bold group-aria-pressed:text-on-accent">
                    {day.day}
                  </span>
                </span>
                <span className="flex h-3.5 items-end gap-0.5" aria-hidden="true">
                  {events.slice(0, TICKS_MAX).map((occurrence) => (
                    <i
                      key={occurrence.id}
                      className="block h-3.5 w-1 rounded-[2px] bg-[var(--c)]"
                      style={{ "--c": colors.get(occurrence.calendarId) } as CSSProperties}
                    />
                  ))}
                </span>
              </button>
            );
          })}
        </div>
      </div>
      <div className="flex flex-col gap-2 px-2 pb-[calc(var(--size-fab)+48px)]">
        {status === "error" && (
          <div
            className="flex items-center justify-between gap-2 rounded-card border border-hairline bg-surface p-4 text-body text-ink shadow-card"
            role="status"
          >
            <span>Your events couldn't be loaded.</span>
            <Button variant="quiet" size="compact" onClick={retry}>
              Try again
            </Button>
          </div>
        )}
        {days.map((day, index) => {
          const rows = byDay[index] ?? [];
          const isToday = sameDate(day, today);
          return (
            <section
              key={dateKey(day)}
              data-day={dateKey(day)}
              className="rounded-card border border-hairline bg-surface px-4 pt-3 pb-1 shadow-card"
              aria-label={formatDayLong(day)}
              aria-busy={status === "loading" || undefined}
            >
              <header className="flex items-center gap-2 pb-1">
                <h2 className="min-w-0 text-heading leading-6 font-semibold text-ink">{formatDayLong(day)}</h2>
                {isToday && (
                  <span className="rounded-pill bg-accent-tint px-2 py-0.5 text-label leading-4 font-semibold text-accent-ink">
                    Today
                  </span>
                )}
              </header>
              {status === "loading" && rows.length === 0 ? (
                <p className="border-t border-hairline py-3 text-body text-muted">Loading…</p>
              ) : rows.length === 0 ? (
                <p className="border-t border-hairline py-3 text-body text-muted">No events</p>
              ) : (
                <DayRows
                  occurrences={rows}
                  calendars={calendars}
                  timeZone={timeZone}
                  now={isToday ? now : null}
                  phone
                  onOpen={(occurrence, anchor) => setDetails({ occurrence, anchor })}
                />
              )}
            </section>
          );
        })}
      </div>
      {details && (
        <DetailsPopover occurrence={details.occurrence} anchor={details.anchor} onClose={() => setDetails(null)} />
      )}
    </div>
  );
}
