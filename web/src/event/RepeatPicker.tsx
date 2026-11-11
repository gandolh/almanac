import { REPEAT_COUNT_MAX, WEEKDAYS, type Weekday } from "@almanac/shared";
import { useId } from "react";
import { ToggleGroup, ToggleItem } from "../components/ui/ToggleGroup";
import { WEEKDAY_INITIALS, WEEKDAY_NAMES } from "../dates";
import {
  chooseEnd,
  choosePreset,
  repeatOptions,
  toggleDay,
  type RepeatDraft,
  type RepeatEndKind,
  type RepeatPreset,
} from "./editor-state";
import { cn } from "../lib/cn";
import { ERROR, HINT, INPUT, SELECT, SELECT_WIDE } from "./looks";

/**
 * How an event repeats (glossary: series), Google's way: a list of presets
 * worded for the start date ("Weekly on Friday", "Monthly on day 16",
 * "Annually on 16 October"), "Custom days…" with a toggle for each weekday,
 * and, once it repeats, how it ends: never, on a date, or after a number of
 * times. Built on the shared repeat types; `editor-state.ts` holds the logic.
 */
export interface RepeatPickerProps {
  repeat: RepeatDraft;
  /** The date the preset labels follow. */
  labelDate: string;
  /** The event's start date, for what a choice starts from. */
  startDate: string;
  timeZone: string;
  /** What the repeat comes to ("Weekly on Monday, Wednesday, until 1 Dec 2026"); shown under the picker for custom days and for a repeat that ends. */
  summary?: string | null;
  /** What is wrong with the repeat, under the picker. */
  error?: string;
  onChange: (next: RepeatDraft) => void;
}

const END_LABELS: Record<RepeatEndKind, string> = { never: "Never", until: "On", count: "After" };

export function RepeatPicker({ repeat, labelDate, startDate, timeZone, summary, error, onChange }: RepeatPickerProps) {
  const noteId = useId();
  const repeating = repeat.preset !== "none";
  // The list already says "Weekly on Friday"; the summary earns its line when there is more to say.
  const detail = summary && (repeat.preset === "custom" || repeat.end !== "never") ? summary : null;
  const note = error ?? detail;
  return (
    <div className="flex flex-col gap-2">
      <select
        className={SELECT_WIDE}
        aria-label="Repeat"
        aria-describedby={note ? noteId : undefined}
        value={repeat.preset}
        onChange={(event) => onChange(choosePreset(repeat, event.target.value as RepeatPreset, startDate))}
      >
        {repeatOptions(labelDate, timeZone).map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

      {repeat.preset === "custom" && (
        <ToggleGroup<Weekday>
          multiple
          label="Repeat on"
          className="flex flex-wrap gap-1"
          value={repeat.days}
          onValueChange={(days) => {
            // Base UI says which days are pressed now; `toggleDay` keeps the week order and the last day.
            const changed = WEEKDAYS.find((day) => days.includes(day) !== repeat.days.includes(day));
            if (changed) onChange(toggleDay(repeat, changed));
          }}
        >
          {WEEKDAYS.map((day, index) => (
            <ToggleItem
              key={day}
              value={day}
              className="flex size-day-toggle items-center justify-center rounded-pill bg-field p-0 text-label font-semibold text-ink-2 hover:bg-control-hover data-pressed:bg-accent data-pressed:text-on-accent data-pressed:hover:bg-accent"
              aria-label={WEEKDAY_NAMES[index]}
              title={WEEKDAY_NAMES[index]}
            >
              {WEEKDAY_INITIALS[index]}
            </ToggleItem>
          ))}
        </ToggleGroup>
      )}

      {repeating && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-meta text-ink-2">Ends</span>
          <select
            className={cn(SELECT, "w-24")}
            aria-label="Repeat ends"
            value={repeat.end}
            onChange={(event) => onChange(chooseEnd(repeat, event.target.value as RepeatEndKind, startDate))}
          >
            {(Object.keys(END_LABELS) as RepeatEndKind[]).map((kind) => (
              <option key={kind} value={kind}>
                {END_LABELS[kind]}
              </option>
            ))}
          </select>
          {repeat.end === "until" && (
            <input
              type="date"
              className={cn(INPUT, "w-date-field")}
              aria-label="Repeat ends on"
              aria-invalid={error !== undefined || undefined}
              value={repeat.until}
              onChange={(event) => onChange({ ...repeat, until: event.target.value })}
            />
          )}
          {repeat.end === "count" && (
            <>
              <input
                type="number"
                className={cn(INPUT, "w-count-field")}
                aria-label="Number of occurrences"
                aria-invalid={error !== undefined || undefined}
                min={1}
                max={REPEAT_COUNT_MAX}
                step={1}
                inputMode="numeric"
                value={repeat.count}
                onChange={(event) => onChange({ ...repeat, count: event.target.value })}
              />
              <span className="text-meta text-ink-2" aria-hidden="true">
                occurrences
              </span>
            </>
          )}
        </div>
      )}

      {note !== null && (
        <p id={noteId} className={error ? ERROR : HINT} role={error ? "alert" : undefined}>
          {note}
        </p>
      )}
    </div>
  );
}
