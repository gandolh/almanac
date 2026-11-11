import { CALENDAR_COLORS, CALENDAR_COLOR_KEYS, type CalendarColor } from "@almanac/shared";
import type { CSSProperties } from "react";
import { CheckIcon } from "../components/icons";
import { ToggleGroup, ToggleItem } from "../components/ui/ToggleGroup";

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
 * round swatches, the chosen one ticked. A guarded toggle group: one swatch
 * stays pressed, the arrow keys only move focus between swatches, and Enter,
 * Space or a click chooses (so a picker that saves at once is not flooded).
 */
export function ColorPicker({ value, onChange, label = "Colour", autoFocus = false }: ColorPickerProps) {
  return (
    <ToggleGroup<CalendarColor> label={label} value={value} onValueChange={onChange} className="color-picker">
      {CALENDAR_COLOR_KEYS.map((color) => {
        const chosen = color === value;
        return (
          <ToggleItem
            key={color}
            value={color}
            aria-label={colorName(color)}
            title={colorName(color)}
            data-autofocus={autoFocus && chosen ? "" : undefined}
            className="color-picker__swatch"
            style={{ "--swatch": CALENDAR_COLORS[color] } as CSSProperties}
          >
            {chosen && <CheckIcon size={18} strokeWidth={3} />}
          </ToggleItem>
        );
      })}
    </ToggleGroup>
  );
}
