import { Toggle } from "@base-ui/react/toggle";
import { ToggleGroup as BaseToggleGroup } from "@base-ui/react/toggle-group";
import type { KeyboardEvent, ReactNode } from "react";

/**
 * A row of toggle buttons on Base UI's `ToggleGroup`: one Tab stop for the
 * group, the arrow keys (and Home and End) move focus between the items
 * without pressing them, and Space, Enter or a click presses. ↑ and ↓ move
 * like ← and → do, for a group wrapped over two rows.
 *
 * - `multiple`: any number are pressed, `value` and `onValueChange` hold
 *   the list (the weekdays of "Custom days…").
 * - Single, the default, is the guarded group (base-ui rule 16) for a picker
 *   that saves on each choice: one item is always pressed, and pressing the
 *   pressed one again reports `value` again rather than clearing it, so a
 *   popover can close on it.
 *
 * `ToggleItem`s sit anywhere inside, wrapped or not.
 */
interface ToggleGroupBase {
  /** The group's name for screen readers. */
  label: string;
  className?: string;
  children: ReactNode;
}

export type ToggleGroupProps<Value extends string> =
  | (ToggleGroupBase & { multiple: true; value: readonly Value[]; onValueChange: (value: Value[]) => void })
  | (ToggleGroupBase & { multiple?: false; value: Value; onValueChange: (value: Value) => void });

/** ↑ and ↓ move focus to the previous and next item, wrapping round. */
function moveByColumn(event: KeyboardEvent<HTMLElement>) {
  if (event.defaultPrevented || (event.key !== "ArrowDown" && event.key !== "ArrowUp")) return;
  const items = Array.from(event.currentTarget.querySelectorAll<HTMLElement>("button:not(:disabled)"));
  const index = items.indexOf(document.activeElement as HTMLElement);
  if (index < 0) return;
  event.preventDefault();
  items[(index + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length]?.focus();
}

export function ToggleGroup<Value extends string>(props: ToggleGroupProps<Value>) {
  const { label, className, children } = props;
  return (
    <BaseToggleGroup
      aria-label={label}
      className={className}
      multiple={props.multiple === true}
      value={props.multiple === true ? props.value : [props.value]}
      onKeyDown={moveByColumn}
      onValueChange={(next) => {
        if (props.multiple === true) props.onValueChange(next);
        else props.onValueChange(next[0] ?? props.value);
      }}
    >
      {children}
    </BaseToggleGroup>
  );
}

export const ToggleItem = Toggle;
