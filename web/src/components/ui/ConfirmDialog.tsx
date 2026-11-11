import { AlertDialog } from "@base-ui/react/alert-dialog";
import { useRef, useState, type ReactNode } from "react";
import { Button } from "../Button";
import { CloseIcon } from "../icons";

/**
 * A question with one action, on Base UI's `AlertDialog`: Cancel (which has
 * focus) or the action. It closes with Cancel, the ✕ or Esc, and not on an
 * outside press. While `onConfirm` runs, nothing closes it, Cancel and ✕ are
 * disabled and the action says `pendingLabel`; it calls `onClose` when the
 * promise settles, done or refused (the caller says what went wrong).
 */
export interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  /** The question; a paragraph or two. */
  message: ReactNode;
  confirmLabel: string;
  /** The action's label while it runs ("Deleting…"). */
  pendingLabel: string;
  onConfirm: () => Promise<void>;
  /** Turns the action off, for a reason the caller shows in `children` and `confirmTitle`. */
  confirmDisabled?: boolean;
  confirmTitle?: string;
  /** More under the message: a note, the reason the action is off. */
  children?: ReactNode;
}

export function ConfirmDialog({
  open,
  onClose,
  title,
  message,
  confirmLabel,
  pendingLabel,
  onConfirm,
  confirmDisabled = false,
  confirmTitle,
  children,
}: ConfirmDialogProps) {
  const [pending, setPending] = useState(false);
  const running = useRef(false);
  const popupRef = useRef<HTMLDivElement>(null);

  const confirm = () => {
    if (running.current) return;
    running.current = true;
    setPending(true);
    void onConfirm().finally(() => {
      running.current = false;
      setPending(false);
      onClose();
    });
  };

  return (
    <AlertDialog.Root
      open={open}
      onOpenChange={(next, details) => {
        if (next || running.current) return;
        // An Esc a control inside already used isn't the dialog's.
        if (details.reason === "escape-key" && details.event.defaultPrevented) return;
        onClose();
      }}
    >
      <AlertDialog.Portal>
        <AlertDialog.Backdrop className="dialog-backdrop" />
        <AlertDialog.Popup
          ref={popupRef}
          className="dialog dialog--small"
          // Cancel, the safe answer, by name, whatever the order.
          initialFocus={() => popupRef.current?.querySelector<HTMLElement>("[data-cancel]") ?? true}
        >
          <div className="dialog__frame">
            <header className="dialog__head">
              <AlertDialog.Title className="dialog__title">{title}</AlertDialog.Title>
              <AlertDialog.Close className="icon-button" aria-label="Close" disabled={pending}>
                <CloseIcon size={20} />
              </AlertDialog.Close>
            </header>
            <div className="dialog__body">
              <AlertDialog.Description render={<div />}>{message}</AlertDialog.Description>
              {children}
            </div>
            <footer className="dialog__footer">
              <AlertDialog.Close
                disabled={pending}
                data-cancel=""
                render={(props) => (
                  <Button {...props} variant="quiet">
                    Cancel
                  </Button>
                )}
              />
              <Button
                variant="primary"
                onClick={confirm}
                disabled={confirmDisabled || pending}
                title={confirmDisabled ? confirmTitle : undefined}
              >
                {pending ? pendingLabel : confirmLabel}
              </Button>
            </footer>
          </div>
        </AlertDialog.Popup>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
