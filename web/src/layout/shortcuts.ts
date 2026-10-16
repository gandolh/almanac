import { useEffect, useRef } from "react";
import type { View } from "../dates";
import type { CommandName } from "./commands";

/**
 * The keyboard shortcuts (corpus/wiki/features.md), Google's:
 *
 *   t            today
 *   d w m y      day, week, month, year
 *   j n →        next
 *   k p ←        previous
 *   c            create (the "create" command)
 *   /            search (the "focusSearch" command)
 *
 * None of them fires while typing in a field, with Ctrl, Alt or Meta held
 * (Shift too, except for `/`, which needs it on some keyboards), when
 * something else already handled the key, or while a dialog, a popover or
 * a menu is open.
 */

export type Shortcut =
  | { kind: "today" }
  | { kind: "view"; view: View }
  | { kind: "step"; by: 1 | -1 }
  | { kind: "command"; name: CommandName };

const KEYS: Readonly<Record<string, Shortcut>> = {
  t: { kind: "today" },
  d: { kind: "view", view: "day" },
  w: { kind: "view", view: "week" },
  m: { kind: "view", view: "month" },
  y: { kind: "view", view: "year" },
  j: { kind: "step", by: 1 },
  n: { kind: "step", by: 1 },
  ArrowRight: { kind: "step", by: 1 },
  k: { kind: "step", by: -1 },
  p: { kind: "step", by: -1 },
  ArrowLeft: { kind: "step", by: -1 },
  c: { kind: "command", name: "create" },
  "/": { kind: "command", name: "focusSearch" },
};

/** What of a key press the filter reads; a `KeyboardEvent` fits. */
export interface KeyPress {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
  defaultPrevented?: boolean;
  isComposing?: boolean;
  target: EventTarget | null;
}

/** The parts of an element the filter looks at, so tests can pass plain objects. */
interface TargetLike {
  tagName?: string;
  isContentEditable?: boolean;
  closest?: (selector: string) => unknown;
}

/** Where a key belongs to the control, not the app: a field, an editable area, an open menu or list. */
export function isTypingTarget(target: EventTarget | null): boolean {
  const element = target as TargetLike | null;
  if (element === null || typeof element !== "object") return false;
  const tag = element.tagName?.toUpperCase();
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (element.isContentEditable) return true;
  return typeof element.closest === "function" && element.closest(OWN_KEYS) !== null;
}

/** Controls that use letters or arrows themselves. */
const OWN_KEYS = '[role="menu"], [role="listbox"], [role="combobox"], [role="slider"], [role="textbox"], [contenteditable=""], [contenteditable="true"]';

/** Open things that the shortcuts stay quiet behind. */
export const OVERLAY_SELECTOR = 'dialog[open], [aria-modal="true"], [role="dialog"], [role="alertdialog"], [role="menu"]';

/** The shortcut a key press asks for, or `null`. `overlayOpen` is whether a dialog, popover or menu is showing. */
export function shortcutFor(press: KeyPress, overlayOpen: boolean): Shortcut | null {
  if (press.defaultPrevented || press.isComposing || overlayOpen) return null;
  if (press.ctrlKey || press.metaKey || press.altKey) return null;
  if (press.shiftKey && press.key !== "/") return null;
  if (isTypingTarget(press.target)) return null;
  const key = press.key.length === 1 ? press.key.toLowerCase() : press.key;
  return KEYS[key] ?? null;
}

/** Listen for the shortcuts on the window while mounted; `onShortcut` runs each one. */
export function useShortcuts(onShortcut: (shortcut: Shortcut) => void): void {
  const handler = useRef(onShortcut);
  useEffect(() => {
    handler.current = onShortcut;
  });
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const shortcut = shortcutFor(event, document.querySelector(OVERLAY_SELECTOR) !== null);
      if (shortcut === null) return;
      // `/` would open the browser's find bar; arrows would scroll.
      event.preventDefault();
      handler.current(shortcut);
    };
    // Bubbling to the window, so a control that used the key first has said so.
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}
