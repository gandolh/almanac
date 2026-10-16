import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { CheckIcon } from "./icons";
import { layerFor } from "./layer";

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

const GAP = 4; // between the button and the menu
const MARGIN = 8; // the menu never comes closer to the window's edge than this

/**
 * A menu button (the WAI-ARIA pattern, Shelfmark's): the button opens a white
 * floating list of actions. Enter, Space or ↓ open it on the first item, ↑ on
 * the last; ↑ ↓ Home End move, a letter jumps to the next item starting with
 * it, Enter or Space chooses, Escape closes and returns to the button, Tab
 * closes and moves on. A click outside closes it. The list is portalled (to
 * `body`, or into the open dialog the button is in) and placed by the button,
 * so no container clips it.
 */
export function Menu({ label, sections, trigger, triggerLabel, triggerClassName, align = "start" }: MenuProps) {
  const [open, setOpen] = useState(false);
  const [layer, setLayer] = useState<HTMLElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const focusOnOpen = useRef<"first" | "last">("first");
  const menuId = useId();

  const itemElements = useCallback(
    (): HTMLButtonElement[] =>
      Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>("[role^=menuitem]:not(:disabled)") ?? []),
    [],
  );

  const close = useCallback((returnFocus: boolean) => {
    setOpen(false);
    if (returnFocus) triggerRef.current?.focus();
  }, []);

  // Place the menu under the button (above it when there is no room), kept
  // inside the window, then focus the chosen item, or the first or last. It
  // follows the button while the page scrolls or resizes. Written straight
  // to the element: measuring needs it in the DOM, and a re-render adds nothing.
  useLayoutEffect(() => {
    const menu = menuRef.current;
    if (!open || !menu) return;
    const place = () => {
      const button = triggerRef.current?.getBoundingClientRect();
      if (!button) return;
      const width = menu.offsetWidth;
      const height = menu.offsetHeight;
      const preferredLeft = align === "end" ? button.right - width : button.left;
      const left = Math.min(Math.max(preferredLeft, MARGIN), window.innerWidth - width - MARGIN);
      const below = button.bottom + GAP;
      const top = below + height <= window.innerHeight - MARGIN ? below : Math.max(MARGIN, button.top - GAP - height);
      menu.style.left = `${Math.round(left)}px`;
      menu.style.top = `${Math.round(top)}px`;
      menu.dataset.placed = "";
    };
    place();
    const elements = itemElements();
    const chosen = elements.find((element) => element.getAttribute("aria-checked") === "true");
    (chosen ?? (focusOnOpen.current === "last" ? elements.at(-1) : elements[0]))?.focus();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, align, itemElements, layer]);

  // A press anywhere outside the button and the menu closes it.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (menuRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      close(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open, close]);

  const openWith = (focus: "first" | "last") => {
    focusOnOpen.current = focus;
    setLayer(layerFor(triggerRef.current));
    setOpen(true);
  };

  const onTriggerKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      openWith(event.key === "ArrowUp" ? "last" : "first");
    }
  };

  const onMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const elements = itemElements();
    const index = elements.indexOf(document.activeElement as HTMLButtonElement);
    const move = (next: number) => {
      event.preventDefault();
      elements[(next + elements.length) % elements.length]?.focus();
    };
    switch (event.key) {
      case "ArrowDown":
        return move(index + 1);
      case "ArrowUp":
        return move(index - 1);
      case "Home":
        return move(0);
      case "End":
        return move(elements.length - 1);
      case "Escape":
        event.preventDefault();
        event.stopPropagation();
        return close(true);
      case "Tab":
        // Back on the button before the browser moves focus, so Tab carries
        // on from where the menu was opened rather than from `body`.
        return close(true);
      default:
        // Space stays the button's (it chooses). The app's shortcuts ignore keys inside a menu.
        if (event.key.length === 1 && event.key !== " " && !event.ctrlKey && !event.metaKey && !event.altKey) {
          const letter = event.key.toLocaleLowerCase();
          const after = [...elements.slice(index + 1), ...elements.slice(0, index + 1)];
          const found = after.find((element) => element.textContent?.trim().toLocaleLowerCase().startsWith(letter));
          if (found) {
            event.preventDefault();
            found.focus();
          }
        }
    }
  };

  const choose = (item: MenuItem) => {
    close(true);
    item.onSelect();
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={triggerClassName ?? "button button--secondary button--regular menu-trigger"}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={triggerLabel}
        onClick={() => (open ? close(false) : openWith("first"))}
        onKeyDown={onTriggerKeyDown}
      >
        {typeof trigger === "string" ? (
          // The open button's label turns semibold; keep its width from moving the row.
          <span className="menu-trigger__label" data-label={trigger}>
            {trigger}
          </span>
        ) : (
          trigger
        )}
      </button>
      {open &&
        layer &&
        createPortal(
          <div ref={menuRef} id={menuId} role="menu" aria-label={label} className="menu" onKeyDown={onMenuKeyDown}>
            {sections.map((section, sectionIndex) => (
              <div key={section.label ?? sectionIndex} role="group" aria-label={section.label} className="menu__section">
                {section.label ? (
                  <div className="menu__label" aria-hidden="true">
                    {section.label}
                  </div>
                ) : sectionIndex > 0 ? (
                  <div role="separator" className="menu__separator" />
                ) : null}
                {section.items.map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    role={item.selected === undefined ? "menuitem" : "menuitemradio"}
                    aria-checked={item.selected}
                    tabIndex={-1}
                    className="menu__item"
                    disabled={item.disabled}
                    onClick={() => choose(item)}
                    // Focus follows the pointer, so one row is ever highlighted.
                    onPointerMove={(event) => {
                      if (document.activeElement !== event.currentTarget) event.currentTarget.focus({ preventScroll: true });
                    }}
                  >
                    {item.selected !== undefined && (
                      <span className="menu__check">{item.selected && <CheckIcon size={18} />}</span>
                    )}
                    <span className="menu__item-label">{item.label}</span>
                    {item.detail && <span className="menu__item-detail">{item.detail}</span>}
                  </button>
                ))}
              </div>
            ))}
          </div>,
          layer,
        )}
    </>
  );
}
