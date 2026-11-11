import { Menu as BaseMenu } from "@base-ui/react/menu";
import { useRef, type ReactNode } from "react";
import { buttonClass } from "../Button";
import { CheckIcon } from "../icons";

export interface MenuItem {
  label: string;
  /** Muted text at the row's end: "Linked", or a shortcut key. */
  detail?: string;
  onSelect: () => void;
  disabled?: boolean;
  /**
   * A choice among the section's items (the phone's view menu): the row is a
   * `menuitemradio`, and the chosen one carries a tick. Left out, a plain action.
   */
  selected?: boolean;
}

export interface MenuSection {
  /** A small heading over the section. Sections without one are split by a line. */
  label?: string;
  items: readonly MenuItem[];
}

export interface MenuProps {
  /** Names the menu: "Account", "View". */
  label: string;
  sections: readonly MenuSection[];
  /** What the button shows: text, or an icon with `triggerLabel`. */
  trigger: ReactNode;
  /** The button's accessible name when `trigger` is only an icon. */
  triggerLabel?: string;
  /** The button's look. Default: a secondary button that turns accent-tinted while open. */
  triggerClassName?: string;
  /** Which edge of the button the menu lines up with. */
  align?: "start" | "end";
}

/** The open button's label turns semibold; a hidden bold copy keeps its width from moving the row. */
const LABEL_CLASS =
  "inline-flex flex-col items-center after:invisible after:pointer-events-none after:h-0 after:overflow-hidden after:font-semibold after:select-none after:content-[attr(data-label)]";
const POPUP_CLASS =
  "flex max-w-[calc(100vw-16px)] min-w-menu flex-col rounded-control bg-surface py-2 text-ink shadow-float outline-none motion-safe:animate-float-in";
const LABEL_HEAD_CLASS = "px-4 pt-1.5 pb-0.5 text-label font-semibold text-muted";
const ITEM_CLASS =
  "flex min-h-10 cursor-default items-center gap-3 bg-transparent px-4 text-left text-meta text-ink select-none not-data-disabled:data-highlighted:bg-hover focus-visible:-outline-offset-2 data-disabled:text-muted max-md:min-h-touch max-md:text-body";

const GAP = 4; // between the button and the menu
const MARGIN = 8; // the menu never comes closer to the window's edge than this

/**
 * A menu button on Base UI's `Menu` (the WAI-ARIA pattern): the button opens
 * a white floating list of actions. Base UI does the keys (Enter, Space or ↓
 * open it, ↑ ↓ Home End move, a letter jumps to the next item starting with
 * it, Escape closes and returns to the button), the placement under the
 * button and the portal, so no container clips it. It is not modal: a click
 * outside closes it and still lands where it was aimed.
 *
 * A chosen item runs when the menu hands focus back, right after focus is on
 * the button again, so an item that opens a dialog, or swaps the button for
 * a field (Rename), takes focus from there and keeps it.
 */
export function Menu({ label, sections, trigger, triggerLabel, triggerClassName, align = "start" }: MenuProps) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const chosen = useRef<MenuItem | null>(null);
  const choose = (item: MenuItem) => () => {
    chosen.current = item;
  };

  return (
    <BaseMenu.Root modal={false}>
      <BaseMenu.Trigger
        ref={triggerRef}
        className={triggerClassName ?? buttonClass({ variant: "secondary", size: "regular" })}
        aria-label={triggerLabel}
      >
        {typeof trigger === "string" ? (
          // The open button's label turns semibold; keep its width from moving the row.
          <span className={LABEL_CLASS} data-label={trigger}>
            {trigger}
          </span>
        ) : (
          trigger
        )}
      </BaseMenu.Trigger>
      <BaseMenu.Portal>
        <BaseMenu.Positioner className="z-float" side="bottom" align={align} sideOffset={GAP} collisionPadding={MARGIN}>
          <BaseMenu.Popup
            className={POPUP_CLASS}
            aria-label={label}
            finalFocus={() => {
              const item = chosen.current;
              if (!item) return true;
              chosen.current = null;
              triggerRef.current?.focus();
              item.onSelect();
              return false;
            }}
          >
            {sections.map((section, sectionIndex) => {
              const heading = section.label ? (
                <BaseMenu.GroupLabel className={LABEL_HEAD_CLASS}>{section.label}</BaseMenu.GroupLabel>
              ) : sectionIndex > 0 ? (
                <BaseMenu.Separator className="my-2 h-px bg-divider" />
              ) : null;
              const chosen = section.items.find((item) => item.selected);
              // A section whose items are choices is a radio group, the chosen one ticked.
              return section.items.some((item) => item.selected !== undefined) ? (
                <BaseMenu.RadioGroup
                  key={section.label ?? sectionIndex}
                  className="flex flex-col"
                  value={chosen?.label ?? null}
                >
                  {heading}
                  {section.items.map((item) => (
                    <BaseMenu.RadioItem
                      key={item.label}
                      value={item.label}
                      className={ITEM_CLASS}
                      disabled={item.disabled}
                      closeOnClick
                      onClick={choose(item)}
                    >
                      <span className="flex w-[18px] flex-none text-ink-2">
                        <BaseMenu.RadioItemIndicator className="flex">
                          <CheckIcon size={18} />
                        </BaseMenu.RadioItemIndicator>
                      </span>
                      <ItemText item={item} />
                    </BaseMenu.RadioItem>
                  ))}
                </BaseMenu.RadioGroup>
              ) : (
                <BaseMenu.Group key={section.label ?? sectionIndex} className="flex flex-col">
                  {heading}
                  {section.items.map((item) => (
                    <BaseMenu.Item
                      key={item.label}
                      className={ITEM_CLASS}
                      disabled={item.disabled}
                      onClick={choose(item)}
                    >
                      <ItemText item={item} />
                    </BaseMenu.Item>
                  ))}
                </BaseMenu.Group>
              );
            })}
          </BaseMenu.Popup>
        </BaseMenu.Positioner>
      </BaseMenu.Portal>
    </BaseMenu.Root>
  );
}

function ItemText({ item }: { item: MenuItem }) {
  return (
    <>
      <span className="flex-1">{item.label}</span>
      {item.detail && <span className="ml-3 text-small text-muted">{item.detail}</span>}
    </>
  );
}
