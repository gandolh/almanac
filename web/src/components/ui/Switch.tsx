import { Switch as BaseSwitch } from "@base-ui/react/switch";
import type { ComponentProps } from "react";

/**
 * An on/off setting that applies at once: Base UI's `Switch`, a
 * `role="switch"` span over a hidden checkbox. The caller names it with
 * `aria-labelledby` (or an enclosing label) and may describe it with
 * `aria-describedby`; `data-autofocus` marks it for a dialog's first focus.
 */
export type SwitchProps = Omit<ComponentProps<typeof BaseSwitch.Root>, "className" | "children">;

// A 36 × 20 track with a 44 px target round it on a touch screen.
const ROOT_CLASS =
  "relative inline-block h-5 w-9 flex-none cursor-pointer rounded-pill bg-outline transition-[background-color] duration-150 ease-[ease] before:absolute before:-inset-x-1 before:-inset-y-3 before:content-[''] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring data-checked:bg-accent data-disabled:cursor-default data-disabled:opacity-50";
const THUMB_CLASS =
  "absolute top-0.5 left-0.5 size-4 rounded-full bg-surface transition-transform duration-150 ease-[ease] data-checked:translate-x-4";

export function Switch(props: SwitchProps) {
  return (
    <BaseSwitch.Root {...props} className={ROOT_CLASS}>
      <BaseSwitch.Thumb className={THUMB_CLASS} />
    </BaseSwitch.Root>
  );
}
