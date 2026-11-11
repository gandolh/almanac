import { Drawer as BaseDrawer } from "@base-ui/react/drawer";
import { useRef, type ReactNode, type RefObject } from "react";

/**
 * The phone's left column: over the view from the left, with the page dimmed
 * behind it. Base UI's `Drawer`, so a swipe to the left closes it as well as
 * a press on the dim, Esc or Android's back gesture. The rest of the shell is
 * inert meanwhile, and focus goes back to `returnFocus` (the menu button).
 * The menus and popovers the calendars open from inside it nest in it, so
 * Esc closes the innermost first. No swipe area: a swipe from the edge to open
 * would fight the sideways swipe on the view (`layout/swipe.ts`).
 *
 * It is named "Calendars" by a visually hidden title. Focus goes to the
 * first `[data-autofocus]` inside, else the first button (Create).
 */
export interface DrawerProps {
  open: boolean;
  onClose: () => void;
  /** What takes focus when the drawer closes. */
  returnFocus: RefObject<HTMLElement | null>;
  children: ReactNode;
}

export function Drawer({ open, onClose, returnFocus, children }: DrawerProps) {
  const popupRef = useRef<HTMLDivElement>(null);
  return (
    <BaseDrawer.Root
      open={open}
      swipeDirection="left"
      onOpenChange={(next, details) => {
        // An Esc a control inside already used (renaming a calendar) isn't the drawer's.
        if (!next && !(details.reason === "escape-key" && details.event.defaultPrevented)) onClose();
      }}
    >
      <BaseDrawer.Portal>
        <BaseDrawer.Backdrop className="drawer__scrim" />
        <BaseDrawer.Viewport className="drawer__viewport">
          <BaseDrawer.Popup
            ref={popupRef}
            id="sidebar"
            className="drawer__panel"
            finalFocus={returnFocus}
            initialFocus={() =>
              popupRef.current?.querySelector<HTMLElement>("[data-autofocus]") ??
              popupRef.current?.querySelector<HTMLElement>("button:not(:disabled)") ??
              true
            }
          >
            <BaseDrawer.Title className="sr-only">Calendars</BaseDrawer.Title>
            <BaseDrawer.Content>{children}</BaseDrawer.Content>
          </BaseDrawer.Popup>
        </BaseDrawer.Viewport>
      </BaseDrawer.Portal>
    </BaseDrawer.Root>
  );
}
