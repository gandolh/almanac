import { useId, useLayoutEffect, useRef, type MouseEvent, type PointerEvent, type ReactNode, type SyntheticEvent } from "react";
import { CloseIcon } from "./icons";

/**
 * A modal dialog on the native `<dialog>` (`showModal`, so focus stays in it
 * and the page behind is inert): a white panel in the middle of the window on
 * the desktop, the whole screen below 768 px. The title row has a close
 * button; `footer` holds the actions (Cancel, then the main one), on the
 * right on the desktop and along the bottom on a phone.
 *
 * Esc, the close button and (unless `dismissOnBackdrop` is false, as a form
 * with typing in it wants) a press on the backdrop call `onClose`. Focus goes
 * to the first `[data-autofocus]` inside, else the first field or button,
 * and back to what had it when the dialog closes. Menus and popovers opened
 * inside are portalled into it (components/layer.ts).
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

export function Dialog(props: DialogProps) {
  return props.open ? <OpenDialog {...props} /> : null;
}

const FOCUSABLE = "input:not(:disabled), select:not(:disabled), textarea:not(:disabled), button:not(:disabled), a[href]";

function OpenDialog({ onClose, title, children, footer, size = "medium", dismissOnBackdrop = true, className }: DialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const before = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (!dialog.open) dialog.showModal();
    const first =
      dialog.querySelector<HTMLElement>("[data-autofocus]") ??
      bodyRef.current?.querySelector<HTMLElement>(FOCUSABLE) ??
      dialog.querySelector<HTMLElement>(".dialog__footer button:not(:disabled)");
    first?.focus();
    return () => {
      if (dialog.open) dialog.close();
      if (before?.isConnected) before.focus();
    };
  }, []);

  // A press on the backdrop is a click on the dialog element itself, from
  // press to release (a text selection dragged out of a field is not one).
  const pressedBackdrop = useRef(false);
  const onPointerDown = (event: PointerEvent<HTMLDialogElement>) => {
    pressedBackdrop.current = event.target === event.currentTarget;
  };
  const onClick = (event: MouseEvent<HTMLDialogElement>) => {
    if (dismissOnBackdrop && pressedBackdrop.current && event.target === event.currentTarget) onClose();
    pressedBackdrop.current = false;
  };
  // Esc: ours to close, so React's `open` stays the truth.
  const onCancel = (event: SyntheticEvent<HTMLDialogElement>) => {
    event.preventDefault();
    onClose();
  };

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      className={["dialog", `dialog--${size}`, className].filter(Boolean).join(" ")}
      onPointerDown={onPointerDown}
      onClick={onClick}
      onCancel={onCancel}
    >
      <div className="dialog__frame">
        <header className="dialog__head">
          <h2 id={titleId} className="dialog__title">
            {title}
          </h2>
          <button type="button" className="icon-button dialog__close" aria-label="Close" onClick={onClose}>
            <CloseIcon size={20} />
          </button>
        </header>
        <div ref={bodyRef} className="dialog__body">
          {children}
        </div>
        {footer && <footer className="dialog__footer">{footer}</footer>}
      </div>
    </dialog>
  );
}
