// STUB: brief 07 replaces this file with quick create and the event form (same exports and signatures).
import type { Occurrence } from "@almanac/shared";
import { createContext, useContext, type ReactNode } from "react";

export interface CreateInit {
  /** A `…Z` instant, or `YYYY-MM-DD` when `allDay`. */
  start?: string;
  end?: string;
  allDay?: boolean;
}

export interface QuickCreateInit {
  start: string;
  end: string;
  allDay: boolean;
  /** What quick create's popover hangs from: the selection's element or rectangle. */
  anchor: Element | DOMRect;
}

export interface EventEditor {
  /** The event form for a new event (the Create button, the `c` key). */
  openCreate(init?: CreateInit): void;
  /** Quick create beside a selection in a view. */
  openQuickCreate(init: QuickCreateInit): void;
  /** The event form for an existing occurrence (the details popover's Edit). */
  openEdit(occurrence: Occurrence): void;
}

const NOTHING: EventEditor = {
  openCreate: () => undefined,
  openQuickCreate: () => undefined,
  openEdit: () => undefined,
};

const EditorContext = createContext<EventEditor>(NOTHING);

/** Wraps the shell (App.tsx). The stub's editor does nothing. */
export function EventEditorProvider({ children }: { children: ReactNode }) {
  return <EditorContext.Provider value={NOTHING}>{children}</EditorContext.Provider>;
}

export function useEventEditor(): EventEditor {
  return useContext(EditorContext);
}
