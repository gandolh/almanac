import { REPEAT_COUNT_MAX, WEEKDAYS } from "@almanac/shared";
import { useId } from "react";
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
import "./editor.css";

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
    <div className="repeat-picker">
      <select
        className="editor-input editor-select"
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
        <div role="group" aria-label="Repeat on" className="repeat-picker__days">
          {WEEKDAYS.map((day, index) => {
            const on = repeat.days.includes(day);
            return (
              <button
                key={day}
                type="button"
                className="repeat-picker__day"
                aria-pressed={on}
                aria-label={WEEKDAY_NAMES[index]}
                title={WEEKDAY_NAMES[index]}
                onClick={() => onChange(toggleDay(repeat, day))}
              >
                {WEEKDAY_INITIALS[index]}
              </button>
            );
          })}
        </div>
      )}

      {repeating && (
        <div className="repeat-picker__end">
          <span className="repeat-picker__end-label">Ends</span>
          <select
            className="editor-input editor-select repeat-picker__end-kind"
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
              className="editor-input editor-date"
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
                className="editor-input editor-count"
                aria-label="Number of occurrences"
                aria-invalid={error !== undefined || undefined}
                min={1}
                max={REPEAT_COUNT_MAX}
                step={1}
                inputMode="numeric"
                value={repeat.count}
                onChange={(event) => onChange({ ...repeat, count: event.target.value })}
              />
              <span className="repeat-picker__times" aria-hidden="true">
                occurrences
              </span>
            </>
          )}
        </div>
      )}

      {note !== null && (
        <p id={noteId} className={error ? "editor-error" : "editor-hint"} role={error ? "alert" : undefined}>
          {note}
        </p>
      )}
    </div>
  );
}
