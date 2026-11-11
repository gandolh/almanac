import { Button } from "../components/Button";
import { CheckIcon } from "../components/icons";
import { RADIO_ROW, RADIO_TICK } from "../components/looks";
import { RadioGroup, RadioIndicator, RadioItem } from "../components/ui/RadioGroup";
import { Dialog } from "../components/ui/Dialog";
import { setTheme, useTheme, type Theme } from "../layout/theme";

export const THEME_LABELS: Readonly<Record<Theme, string>> = { light: "Light", dark: "Dark", system: "System" };

const CHOICES: readonly { value: Theme; hint: string }[] = [
  { value: "light", hint: "Always light." },
  { value: "dark", hint: "Always dark." },
  { value: "system", hint: "Follows this device." },
];

export interface ThemeDialogProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Light, Dark or System, kept on this device only (nothing goes to the server, so a RadioGroup, not a
 * toggle): choosing one applies it at once, which is the point of trying each.
 */
export function ThemeDialog({ open, onClose }: ThemeDialogProps) {
  const theme = useTheme();
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Theme"
      size="small"
      footer={
        <Button variant="quiet" onClick={onClose}>
          Done
        </Button>
      }
    >
      <RadioGroup<Theme>
        aria-label="Theme"
        value={theme}
        onValueChange={setTheme}
        className="overflow-hidden rounded-control border border-hairline"
      >
        {CHOICES.map(({ value, hint }) => (
          <RadioItem key={value} value={value} className={RADIO_ROW} data-autofocus={value === theme ? "" : undefined}>
            <span className={RADIO_TICK}>
              <RadioIndicator>
                <CheckIcon size={18} />
              </RadioIndicator>
            </span>
            <span className="flex min-w-0 flex-col">
              <span className="text-meta max-md:text-body">{THEME_LABELS[value]}</span>
              <span className="text-small text-muted">{hint}</span>
            </span>
          </RadioItem>
        ))}
      </RadioGroup>
    </Dialog>
  );
}
