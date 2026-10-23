import { Dialog } from "@base-ui/react/dialog";
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import type { Temporal } from "temporal-polyfill";
import { PlusIcon } from "../components/icons";
import { Toaster } from "../components/Toast";
import { useSettings, useToday } from "../data/settings";
import { DEFAULT_VIEW, rangeTitle, rangeTitleShort, stepDate, type View } from "../dates";
import { useEventEditor } from "../event/EventEditor";
import {
  SEARCH,
  dateOfRoute,
  isViewRoute,
  lastViewRoute,
  navigate,
  pathFor,
  rememberViewRoute,
  replaceWithCanonical,
  usePathname,
  useQueryParam,
  useRoute,
  viewRoute,
  type Route,
} from "../router";
import { SearchResults } from "../search/SearchResults";
import { YearView } from "../year/YearView";
import { runCommand } from "./commands";
import { useShortcuts, type Shortcut } from "./shortcuts";
import { useSwipe } from "./swipe";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { useIsDesktop } from "../components/viewport";

// FullCalendar is most of the bundle: the views load on first use, the year view and search don't need it.
const CalendarArea = lazy(() => import("../calendar/CalendarArea").then((m) => ({ default: m.CalendarArea })));

/** What the address shows: a view on a date, the search results, or nothing yet (home, or an address the app doesn't have). */
export type Place = { kind: "view"; view: View; date: Temporal.PlainDate } | { kind: "search" } | { kind: "home" };

export function placeOf(route: Route): Place {
  if (route.name === "search") return { kind: "search" };
  if (isViewRoute(route)) {
    const date = dateOfRoute(route);
    if (date !== null) return { kind: "view", view: route.name, date };
  }
  return { kind: "home" };
}

/** The document's title: "October 2026 · Almanac". */
export function documentTitle(place: Place): string {
  if (place.kind === "view") return `${rangeTitle(place.view, place.date)} · Almanac`;
  if (place.kind === "search") return "Search · Almanac";
  return "Almanac";
}

const COLUMN_KEY = "almanac.sidebar";

function readColumnPref(): boolean {
  try {
    return window.localStorage.getItem(COLUMN_KEY) !== "hidden";
  } catch {
    return true;
  }
}

function writeColumnPref(open: boolean): void {
  try {
    window.localStorage.setItem(COLUMN_KEY, open ? "shown" : "hidden");
  } catch {
    // Private mode or blocked storage: the column just won't remember.
  }
}

/**
 * The signed-in app, Google Calendar's layout: the top bar over the left
 * column and the view. 768 px and up the column sits beside the view (the
 * menu button hides it, remembered per browser); below, it is a drawer over
 * the view, Create is a round button in the corner, and a sideways swipe
 * on the view steps it (the phone's bar has no room for ‹ ›).
 *
 * The address is the truth: `/` (and any address the app doesn't have, or an
 * impossible date) goes on to this month in the display time zone, once the
 * settings have said which zone that is; a loose address is tidied to its
 * canonical form. The keys, Today, ‹ › and the mini-month all move the
 * address.
 */
export function AppShell() {
  const route = useRoute();
  const pathname = usePathname();
  const query = useQueryParam("q");
  const desktop = useIsDesktop();
  const { status: settingsStatus } = useSettings();
  const today = useToday();
  const editor = useEventEditor();
  const place = useMemo(() => placeOf(route), [route]);
  const [columnOpen, setColumnOpen] = useState(readColumnPref);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const mainRef = useRef<HTMLElement>(null);

  // The view and date the bar, the column and the keys work from: the
  // address's, or on the search results the last view's.
  const fallback = lastViewRoute();
  const fallbackDate = (fallback.name !== "home" && dateOfRoute(fallback)) || today;
  const view: View = place.kind === "view" ? place.view : fallback.name !== "home" ? fallback.name : DEFAULT_VIEW;
  const date = place.kind === "view" ? place.date : fallbackDate;

  useEffect(() => {
    if (place.kind === "home") {
      // "Today" is the display time zone's: wait for the settings to say which.
      if (settingsStatus !== "loading") navigate(viewRoute(DEFAULT_VIEW, today), { replace: true });
      return;
    }
    const canonical = place.kind === "view" ? viewRoute(place.view, place.date) : SEARCH;
    if (pathname !== pathFor(canonical)) replaceWithCanonical(canonical);
  }, [place, pathname, settingsStatus, today]);

  useEffect(() => {
    if (place.kind === "view") rememberViewRoute(viewRoute(place.view, place.date));
  }, [place]);

  useEffect(() => {
    document.title = documentTitle(place);
  }, [place]);

  const go = useCallback((to: View, on: Temporal.PlainDate) => navigate(viewRoute(to, on)), []);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  useShortcuts((shortcut: Shortcut) => {
    switch (shortcut.kind) {
      case "today":
        return go(view, today);
      case "view":
        return go(shortcut.view, date);
      case "step":
        if (place.kind === "view") go(view, stepDate(view, date, shortcut.by));
        return;
      case "command":
        runCommand(shortcut.name);
        return;
    }
  });

  // The phone's ‹ ›.
  useSwipe(mainRef, !desktop && place.kind === "view", (by) => go(view, stepDate(view, date, by)));

  const drawerShown = !desktop && drawerOpen;
  const sidebar = (
    <Sidebar
      date={date}
      today={today}
      onPickDate={(picked) => {
        if (drawerShown) closeDrawer();
        go(view, picked);
      }}
    />
  );

  let main: ReactNode = null;
  if (place.kind === "search") main = <SearchResults query={query} />;
  else if (place.kind === "view") {
    const shown = place.view;
    main =
      shown === "year" ? (
        <YearView year={place.date.year} onOpenDay={(day) => go("day", day)} onOpenMonth={(first) => go("month", first)} />
      ) : (
        <Suspense fallback={<div className="calendar-area" />}>
          <CalendarArea view={shown} date={place.date} onNavigate={go} />
        </Suspense>
      );
  }

  return (
    <div className={desktop ? "shell shell--desktop" : "shell shell--phone"}>
      <a className="skip-link" href="#main">
        Skip to the calendar
      </a>
      <div className="shell__bar">
        <TopBar
          view={place.kind === "view" ? place.view : null}
          date={date}
          today={today}
          title={
            place.kind === "view"
              ? (desktop ? rangeTitle : rangeTitleShort)(place.view, place.date)
              : place.kind === "search"
                ? "Search"
                : ""
          }
          compact={!desktop}
          sidebarOpen={desktop ? columnOpen : drawerShown}
          menuButtonRef={menuButton}
          onMenu={() => {
            if (desktop) {
              writeColumnPref(!columnOpen);
              setColumnOpen(!columnOpen);
            } else setDrawerOpen(true);
          }}
          onToday={() => go(view, today)}
          onStep={(by) => go(view, stepDate(view, date, by))}
        />
      </div>
      <div className="shell__body">
        {desktop && (
          <aside id="sidebar" className="shell__column" aria-label="Calendars" hidden={!columnOpen}>
            {sidebar}
          </aside>
        )}
        <main ref={mainRef} id="main" className="shell__main" tabIndex={-1}>
          {main}
        </main>
      </div>
      <Drawer open={drawerShown} onClose={closeDrawer} menuButton={menuButton}>
        {sidebar}
      </Drawer>
      {!desktop && !drawerShown && (
        <button type="button" className="fab" aria-label="Create" onClick={() => editor.openCreate()}>
          <PlusIcon size={26} />
        </button>
      )}
      <Toaster />
    </div>
  );
}

/**
 * The phone's left column: over the view from the left, with the page dimmed
 * behind it. A modal Base UI `Dialog`: Esc or a press on the dim closes it,
 * the rest of the shell is inert meanwhile, and focus goes back to the menu
 * button. The menus and popovers the calendars open from inside it nest in
 * it, so Esc closes the innermost first.
 */
function Drawer({
  open,
  onClose,
  menuButton,
  children,
}: {
  open: boolean;
  onClose: () => void;
  menuButton: RefObject<HTMLButtonElement | null>;
  children: ReactNode;
}) {
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next, details) => {
        // An Esc a control inside already used (renaming a calendar) isn't the drawer's.
        if (!next && !(details.reason === "escape-key" && details.event.defaultPrevented)) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop className="drawer__scrim" />
        <Dialog.Popup id="sidebar" className="drawer__panel" aria-label="Calendars" finalFocus={menuButton}>
          {children}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
