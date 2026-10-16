// STUB: brief 09 replaces this file with the managed "My calendars" list (same export, no props).
import type { CSSProperties } from "react";
import { calendarColor, useCalendars } from "../data/calendars";
import "../styles/stubs.css";

/** Until brief 09: the user's calendars with their colours, read-only. */
export function CalendarList() {
  const { calendars, status } = useCalendars();
  return (
    <section className="stub-calendars" aria-labelledby="stub-calendars-title">
      <h2 id="stub-calendars-title" className="stub-calendars__title">
        My calendars
      </h2>
      {status === "error" && <p className="stub-calendars__note">Your calendars couldn't be loaded.</p>}
      <ul className="stub-calendars__list">
        {calendars.map((calendar) => (
          <li key={calendar.id} className="stub-calendars__row">
            <span
              className="stub-calendars__swatch"
              data-hidden={!calendar.visible || undefined}
              style={{ "--calendar-color": calendarColor(calendar) } as CSSProperties}
              aria-hidden="true"
            />
            <span className="stub-calendars__name">{calendar.name}</span>
            {!calendar.visible && <span className="visually-hidden">(hidden)</span>}
          </li>
        ))}
      </ul>
    </section>
  );
}
