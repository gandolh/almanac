import type { Occurrence } from "@almanac/shared";
import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { releaseSelection } from "../calendar/selection";
import { useIsDesktop } from "../components/viewport";
import { registerCommand } from "../layout/commands";
import { usePathname } from "../router";
import { quickSession, type CreateInit, type QuickCreateInit, type Session } from "./editor-session";
import type { FormSeed } from "./editor-state";
import { EventForm } from "./EventForm";
import { QuickCreate } from "./QuickCreate";

/**
 * Creating and editing events: quick create beside a selection, and the
 * event form for everything else (glossary: quick create, event form).
 * `EventEditorProvider` wraps the shell (App.tsx) and owns whichever of the
 * two is open; any view or button opens them through `useEventEditor()`.
 *
 * - `openQuickCreate` is the desktop's popover. Below 768 px it opens the
 *   event form instead, with the same times. Asked again for the span it
 *   already shows (a press on its own selection), it stays as it is.
 * - Quick create ends six ways (saved, discarded, Esc, "More options", the
 *   phone's form instead, and the address moving, Back and Forward too) and
 *   every one lets go of the view's selection (`releaseSelection`).
 * - The "create" command (the `c` key) opens the form for a new event.
 */

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

/** Wraps the shell (App.tsx). */
export function EventEditorProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const opened = useRef(0);
  const desktop = useIsDesktop();
  const desktopNow = useRef(desktop);
  useLayoutEffect(() => {
    desktopNow.current = desktop;
  });

  const openCreate = useCallback((init: CreateInit = {}) => {
    releaseSelection();
    setSession({ kind: "create", key: ++opened.current, seed: init });
  }, []);

  const openQuickCreate = useCallback((init: QuickCreateInit) => {
    if (!desktopNow.current) {
      // A phone has no room for the popover: the form, with the same times.
      releaseSelection();
      setSession({ kind: "create", key: ++opened.current, seed: { start: init.start, end: init.end, allDay: init.allDay } });
      return;
    }
    const key = ++opened.current;
    setSession((current) => quickSession(current, init, key));
  }, []);

  const openEdit = useCallback((occurrence: Occurrence) => {
    releaseSelection();
    setSession({ kind: "edit", key: ++opened.current, occurrence });
  }, []);

  // However quick create ends, the view's selection goes.
  const closeQuick = useCallback(() => {
    releaseSelection();
    setSession(null);
  }, []);

  const moreOptions = useCallback((seed: FormSeed) => {
    releaseSelection();
    setSession({ kind: "create", key: ++opened.current, seed });
  }, []);

  const closeForm = useCallback(() => setSession(null), []);

  // The address moved (a link, a shortcut, Back or Forward): quick create
  // belonged to the view that was there. The event form stays, with its typing.
  const pathname = usePathname();
  const [pathShown, setPathShown] = useState(pathname);
  if (pathShown !== pathname) {
    setPathShown(pathname);
    if (session?.kind === "quick") setSession(null);
  }
  useEffect(() => {
    releaseSelection();
  }, [pathname]);

  useEffect(() => registerCommand("create", () => openCreate()), [openCreate]);

  const editor = useMemo<EventEditor>(() => ({ openCreate, openQuickCreate, openEdit }), [openCreate, openQuickCreate, openEdit]);

  return (
    <EditorContext.Provider value={editor}>
      {children}
      {session?.kind === "quick" && (
        <QuickCreate key={session.key} init={session.init} onClose={closeQuick} onSaved={closeQuick} onMoreOptions={moreOptions} />
      )}
      {session?.kind === "create" && <EventForm key={session.key} seed={session.seed} onClose={closeForm} />}
      {session?.kind === "edit" && <EventForm key={session.key} occurrence={session.occurrence} onClose={closeForm} />}
    </EditorContext.Provider>
  );
}

export function useEventEditor(): EventEditor {
  return useContext(EditorContext);
}
