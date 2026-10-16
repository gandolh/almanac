import { CALENDAR_COLORS, CALENDAR_COLOR_KEYS, type CalendarColor } from "@almanac/shared";
import type { CSSProperties, KeyboardEvent } from "react";
import { CheckIcon } from "../components/icons";
import "./calendars.css";

/** "blue" → "Blue": a colour's name for the screen reader and the tooltip. */
export function colorName(color: CalendarColor): string {
  return color.charAt(0).toUpperCase() + color.slice(1);
}

export interface ColorPickerProps {
  value: CalendarColor;
  onChange: (color: CalendarColor) => void;
  /** The group's accessible name. */
  label?: string;
  /** Move focus to the chosen swatch when the picker opens (in a popover; a form keeps its first field). */
  autoFocus?: boolean;
}

/**
 * The calendar palette (`CALENDAR_COLORS`, in its order) as two rows of
 * round swatches, the chosen one ticked. A radio group: one swatch is in the
 * Tab order, the arrow keys move between swatches, Enter, Space or a click
 * chooses (the arrows only move, so a picker that saves at once is not
 * flooded).
 */
export function ColorPicker({ value, onChange, label = "Colour", autoFocus = false }: ColorPickerProps) {
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const swatches = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>("[role=radio]"));
    const index = swatches.indexOf(document.activeElement as HTMLButtonElement);
    if (index < 0) return;
    let next: number;
    switch (event.key) {
      case "ArrowRight":
      case "ArrowDown":
        next = index + 1;
        break;
      case "ArrowLeft":
      case "ArrowUp":
        next = index - 1;
        break;
      case "Home":
        next = 0;
        break;
      case "End":
        next = swatches.length - 1;
        break;
      default:
        return;
    }
    event.preventDefault();
    swatches[(next + swatches.length) % swatches.length]?.focus();
  };

  return (
    <div className="color-picker" role="radiogroup" aria-label={label} onKeyDown={onKeyDown}>
      {CALENDAR_COLOR_KEYS.map((color) => {
        const chosen = color === value;
        return (
          <button
            key={color}
            type="button"
            role="radio"
            aria-checked={chosen}
            aria-label={colorName(color)}
            title={colorName(color)}
            tabIndex={chosen ? 0 : -1}
            data-autofocus={autoFocus && chosen ? "" : undefined}
            className="color-picker__swatch"
            style={{ "--swatch": CALENDAR_COLORS[color] } as CSSProperties}
            onClick={() => onChange(color)}
          >
            {chosen && <CheckIcon size={18} strokeWidth={3} />}
          </button>
        );
      })}
    </div>
  );
}
