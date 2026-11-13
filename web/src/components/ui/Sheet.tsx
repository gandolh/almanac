import { Dialog as BaseDialog } from "@base-ui/react/dialog";
import { useRef, type ReactNode } from "react";
import { DIALOG } from "../looks";

/**
 * The phone's bottom sheet: a modal panel that comes up from the bottom edge
 * over a scrim, with a grab mark, rounded top corners and the gesture inset
 * under its last row. Base UI's `Dialog`, so focus stays in it, the page
 * behind is inert, and Esc, a press on the scrim or Android's back call
 * `onClose` (an Esc a control inside already used isn't the sheet's). Focus
 * goes to the first `[data-autofocus]` inside, else the sheet itself, and back
 * to what had it on close. Mounted means open. The event details are the one
 * user: the desktop's popover becomes this below 768 px.
 */
export interface SheetProps {
  onClose: () => void;
  /** The id of a heading inside, which names the sheet. */
  labelledBy: string;
  children: ReactNode;
}

export function Sheet({ onClose, labelledBy, children }: SheetProps) {
  const popupRef = useRef<HTMLDivElement>(null);
  return (
    <BaseDialog.Root
      open
      onOpenChange={(next, details) => {
        if (!next && !(details.reason === "escape-key" && details.event.defaultPrevented)) onClose();
      }}
    >
      <BaseDialog.Portal>
        <BaseDialog.Backdrop className={DIALOG.backdrop} />
        <BaseDialog.Popup
          ref={popupRef}
          aria-labelledby={labelledBy}
          className="fixed inset-x-0 bottom-0 z-float max-h-[85dvh] overflow-y-auto overscroll-contain rounded-t-sheet border border-b-0 border-hairline bg-surface px-5 pt-2 pb-[max(16px,env(safe-area-inset-bottom))] text-ink shadow-float focus:outline-none motion-safe:animate-sheet-in"
          initialFocus={() => popupRef.current?.querySelector<HTMLElement>("[data-autofocus]") ?? true}
        >
          <div className="mx-auto mb-2 h-1 w-10 rounded-[2px] bg-outline" aria-hidden="true" />
          {children}
        </BaseDialog.Popup>
      </BaseDialog.Portal>
    </BaseDialog.Root>
  );
}
