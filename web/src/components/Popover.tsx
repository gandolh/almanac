import { Popover as BasePopover } from "@base-ui/react/popover";
import { useMemo, useRef, type ReactNode } from "react";

/**
 * A white floating panel anchored to an element or a rectangle: quick create
 * and the event details beside an event (briefs 06, 07), a day's list in the
 * year view (brief 08). Mounted means open: render it to show it, stop
 * rendering it to hide it.
 *
 * - `placement: "below"` hangs under the anchor, lined up with its start;
 *   `"side"` sits to its right, lined up with its top. Base UI flips it to
 *   the other side when there is no room and keeps it inside the window.
 * - Esc and a press outside call `onClose` (a press on the anchor element
 *   doesn't, so the anchor's own click can toggle).
 * - It is a non-modal `role="dialog"` on Base UI's `Popover`: focus moves into
 *   it on open (the first `[data-autofocus]`, else the first focusable, else
 *   the panel) and back to where it was on close. While one is open the
 *   app's keyboard shortcuts are off.
 */
export interface PopoverProps {
  anchor: Element | DOMRect;
  onClose: () => void;
  children: ReactNode;
  placement?: "below" | "side";
  /** The accessible name; or `labelledBy`, the id of a heading inside. */
  label?: string;
  labelledBy?: string;
  className?: string;
  /** Move focus into the panel on open. Default true. */
  autoFocus?: boolean;
}

const GAP = 8; // between the anchor and the panel
const MARGIN = 8; // the panel never comes closer to the window's edge than this

export function Popover({ anchor, onClose, children, placement = "below", label, labelledBy, className, autoFocus = true }: PopoverProps) {
  const popupRef = useRef<HTMLDivElement>(null);

  // What Base UI places against. An anchor element that left the page (a view
  // re-rendered) keeps its last place.
  const virtualAnchor = useMemo(() => {
    if (!(anchor instanceof Element)) return { getBoundingClientRect: () => anchor };
    let last = anchor.getBoundingClientRect();
    return {
      contextElement: anchor,
      getBoundingClientRect: () => {
        if (anchor.isConnected) last = anchor.getBoundingClientRect();
        return last;
      },
    };
  }, [anchor]);

  return (
    <BasePopover.Root
      open
      onOpenChange={(open, details) => {
        if (open) return;
        // An Esc a control inside already used isn't the popover's.
        if (details.reason === "escape-key" && details.event.defaultPrevented) return;
        // A press on the anchor is the anchor's own: its click toggles.
        const target = details.event.target;
        if (details.reason === "outside-press" && anchor instanceof Element && target instanceof Node && anchor.contains(target)) return;
        onClose();
      }}
    >
      <BasePopover.Portal>
        <BasePopover.Positioner
          className="popover-positioner"
          anchor={virtualAnchor}
          side={placement === "below" ? "bottom" : "right"}
          align="start"
          sideOffset={GAP}
          collisionPadding={MARGIN}
        >
          <BasePopover.Popup
            ref={popupRef}
            aria-label={labelledBy ? undefined : label}
            aria-labelledby={labelledBy}
            className={className ? `popover ${className}` : "popover"}
            data-placement={placement}
            initialFocus={autoFocus ? () => popupRef.current?.querySelector<HTMLElement>("[data-autofocus]") ?? true : false}
          >
            {children}
          </BasePopover.Popup>
        </BasePopover.Positioner>
      </BasePopover.Portal>
    </BasePopover.Root>
  );
}
