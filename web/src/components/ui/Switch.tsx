import { Switch as BaseSwitch } from "@base-ui/react/switch";
import type { ComponentProps } from "react";

/**
 * An on/off setting that applies at once: Base UI's `Switch`, a
 * `role="switch"` span over a hidden checkbox. The caller names it with
 * `aria-labelledby` (or an enclosing label) and may describe it with
 * `aria-describedby`; `data-autofocus` marks it for a dialog's first focus.
 */
export type SwitchProps = Omit<ComponentProps<typeof BaseSwitch.Root>, "className" | "children">;

export function Switch(props: SwitchProps) {
  return (
    <BaseSwitch.Root {...props} className="switch">
      <BaseSwitch.Thumb className="switch__thumb" />
    </BaseSwitch.Root>
  );
}
