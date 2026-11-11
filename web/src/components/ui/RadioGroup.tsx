import { Radio } from "@base-ui/react/radio";
import { RadioGroup as BaseRadioGroup } from "@base-ui/react/radio-group";

/**
 * One choice from a list, on Base UI's `RadioGroup`: Tab enters the group at
 * the chosen item, and the arrow keys move and choose (nothing is saved by a
 * choice, so trying each one is the point). Home and End go to the first and
 * last item and choose it, which Base UI's group leaves out.
 *
 * `RadioItem` is one choice (a `<span role="radio">` over a hidden input),
 * which takes any content; `RadioIndicator` shows its children only while the
 * item is chosen.
 */
export function RadioGroup<Value extends string>({ onKeyDown, ...props }: BaseRadioGroup.Props<Value>) {
  return (
    <BaseRadioGroup<Value>
      {...props}
      onKeyDown={(event) => {
        onKeyDown?.(event);
        if (event.defaultPrevented || (event.key !== "Home" && event.key !== "End")) return;
        const items = Array.from(
          event.currentTarget.querySelectorAll<HTMLElement>('[role="radio"]:not([aria-disabled="true"])'),
        );
        const target = event.key === "Home" ? items[0] : items.at(-1);
        if (!target) return;
        event.preventDefault();
        target.focus();
        target.click();
      }}
    />
  );
}

export const RadioItem = Radio.Root;
export const RadioIndicator = Radio.Indicator;
