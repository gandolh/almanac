import { Dialog as BaseDialog } from "@base-ui/react/dialog";
import { useRef, type ReactNode } from "react";
import { CloseIcon } from "./icons";

/**
 * A modal dialog on Base UI's `Dialog` (focus stays in it and the page behind
 * is inert): a white panel in the middle of the window on the desktop, the
 * whole screen below 768 px. The title row has a close button; `footer`
 * holds the actions (Cancel, then the main one), on the right on the desktop
 * and along the bottom on a phone.
 *
 * Esc, the close button and (unless `dismissOnBackdrop` is false, as a form
 * with typing in it wants) a press on the backdrop call `onClose`. Focus goes
 * to the first `[data-autofocus]` inside, else the first field or button,
 * and back to what had it when the dialog closes. Menus and popovers opened
 * inside are Base UI's too, so they nest in it and Esc closes the innermost.
 */
export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  /** The desktop width: 400, 560 or 720 px. Default `medium`. */
  size?: "small" | "medium" | "large";
  dismissOnBackdrop?: boolean;
  className?: string;
}

const FOCUSABLE = "input:not(:disabled), select:not(:disabled), textarea:not(:disabled), button:not(:disabled), a[href]";

export function Dialog({ open, onClose, title, children, footer, size = "medium", dismissOnBackdrop = true, className }: DialogProps) {
  const popupRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  return (
    <BaseDialog.Root
      open={open}
      onOpenChange={(next, details) => {
        // An Esc a control inside already used (a time list closing) isn't the dialog's.
        if (!next && !(details.reason === "escape-key" && details.event.defaultPrevented)) onClose();
      }}
      disablePointerDismissal={!dismissOnBackdrop}
    >
      <BaseDialog.Portal>
        <BaseDialog.Backdrop className="dialog-backdrop" />
        <BaseDialog.Popup
          ref={popupRef}
          className={["dialog", `dialog--${size}`, className].filter(Boolean).join(" ")}
          // Not the title row's close button: the first field, as before.
          initialFocus={() =>
            popupRef.current?.querySelector<HTMLElement>("[data-autofocus]") ??
            bodyRef.current?.querySelector<HTMLElement>(FOCUSABLE) ??
            popupRef.current?.querySelector<HTMLElement>(".dialog__footer button:not(:disabled)") ??
            true
          }
        >
          <div className="dialog__frame">
            <header className="dialog__head">
              <BaseDialog.Title className="dialog__title">{title}</BaseDialog.Title>
              <BaseDialog.Close className="icon-button" aria-label="Close">
                <CloseIcon size={20} />
              </BaseDialog.Close>
            </header>
            <div ref={bodyRef} className="dialog__body">
              {children}
            </div>
            {footer && <footer className="dialog__footer">{footer}</footer>}
          </div>
        </BaseDialog.Popup>
      </BaseDialog.Portal>
    </BaseDialog.Root>
  );
}
