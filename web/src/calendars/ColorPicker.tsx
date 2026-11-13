import { CALENDAR_COLOR_KEYS, type CalendarColor } from "@almanac/shared";
import type { CSSProperties } from "react";
import { CheckIcon } from "../components/icons";
import { calendarColor, calendarInk } from "../data/calendars";
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
 * The calendar palette (`CALENDAR_COLOR_KEYS`, in its order) as two rows of
 * round swatches, the chosen one ticked. A guarded toggle group: one swatch
 * stays pressed, the arrow keys only move focus between swatches, and Enter,
 * Space or a click chooses (so a picker that saves at once is not flooded).
 */
export function ColorPicker({ value, onChange, label = "Colour", autoFocus = false }: ColorPickerProps) {
  return (
    <ToggleGroup<CalendarColor>
      label={label}
      value={value}
      onValueChange={onChange}
      className="grid grid-cols-[repeat(5,32px)] gap-2 max-md:grid-cols-[repeat(5,var(--size-touch))]"
    >
      {CALENDAR_COLOR_KEYS.map((color) => {
        const chosen = color === value;
        return (
          <ToggleItem
            key={color}
            value={color}
            aria-label={colorName(color)}
            title={colorName(color)}
            data-autofocus={autoFocus && chosen ? "" : undefined}
            className="flex size-8 items-center justify-center rounded-pill bg-(color:--swatch) p-0 text-(color:--on-calendar) transition-[box-shadow] duration-(--duration-fast) ease-out hover:shadow-[0_0_0_4px_color-mix(in_srgb,var(--swatch)_24%,transparent)] focus-visible:outline-offset-3 max-md:size-touch"
            style={{ "--swatch": calendarColor({ color }), "--on-calendar": calendarInk(color) } as CSSProperties}
          >
            {chosen && <CheckIcon size={18} strokeWidth={3} />}
          </ToggleItem>
        );
      })}
    </ToggleGroup>
  );
}
