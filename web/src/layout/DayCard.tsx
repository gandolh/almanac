import { useState } from "react";
import { Button } from "../components/Button";
import { useCalendars } from "../data/calendars";
import { useOccurrenceSpan, useWallClock } from "../data/occurrence-span";
import { useSettings } from "../data/settings";
import { formatDayLong, sameDate, type Temporal } from "../dates";
import { DetailsPopover } from "../event/DetailsPopover";
import { occurrencesOn } from "../year/days";
import { DayRows } from "./DayRows";

export interface DayCardProps {
  /** The chosen day: the date the view is on. */
  date: Temporal.PlainDate;
  today: Temporal.PlainDate;
}

/**
 * The left column's last card: the chosen day as a list ("Wednesday, 11
 * November"), with the "Today" tag when it is today and the now rule among
 * the rows, so what's next never needs a click. A row opens that event's
 * details beside it.
 */
export function DayCard({ date, today }: DayCardProps) {
  const { timeZone } = useSettings();
  const { calendars } = useCalendars();
  const { occurrences, status, retry } = useOccurrenceSpan({ start: date, end: date.add({ days: 1 }) }, timeZone);
  const now = useWallClock(timeZone);
  const [details, setDetails] = useState<{
    occurrence: Parameters<typeof DetailsPopover>[0]["occurrence"];
    anchor: Element;
  } | null>(null);
  const isToday = sameDate(date, today);
  const rows = occurrencesOn(date, occurrences, calendars, timeZone);

  return (
    <section
      className="flex flex-col rounded-card border border-hairline bg-surface p-3 shadow-card"
      aria-label={formatDayLong(date)}
      aria-busy={status === "loading" || undefined}
    >
      <header className="flex items-center gap-2">
        <h2 className="min-w-0 text-action-large leading-tight font-semibold text-ink">{formatDayLong(date)}</h2>
        {isToday && (
          <span className="rounded-pill bg-accent-tint px-2 py-0.5 text-label leading-4 font-semibold text-accent-ink">
            Today
          </span>
        )}
      </header>
      {status === "error" ? (
        <div
          className="mt-2 flex items-center justify-between gap-2 border-t border-hairline pt-2 text-small text-muted"
          role="status"
        >
          <span>Your events couldn't be loaded.</span>
          <Button variant="quiet" size="compact" onClick={retry}>
            Try again
          </Button>
        </div>
      ) : status === "ready" && rows.length === 0 ? (
        <p className="mt-2 border-t border-hairline pt-2 text-body text-muted">No events</p>
      ) : (
        <DayRows
          occurrences={rows}
          calendars={calendars}
          timeZone={timeZone}
          now={isToday ? now : null}
          onOpen={(occurrence, anchor) => setDetails({ occurrence, anchor })}
        />
      )}
      {details && (
        <DetailsPopover occurrence={details.occurrence} anchor={details.anchor} onClose={() => setDetails(null)} />
      )}
    </section>
  );
}
