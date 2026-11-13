import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Temporal } from "temporal-polyfill";
import { PlusIcon } from "../components/icons";
import { Drawer } from "../components/ui/Drawer";
import { Toaster } from "../components/ui/Toast";
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
import { TopBar, type BarLayout } from "./TopBar";
import { ViewBar } from "./ViewSwitcher";
import { WeekAgenda } from "./WeekAgenda";
import { useIsDesktop, useIsWide } from "../components/viewport";
import { cn } from "../lib/cn";

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
 * The signed-in app: the header band over the left column and the view.
 *
 * - From 1100 px the column (Create, the mini-month, My calendars, the chosen
 *   day) sits beside the view and scrolls on its own; the menu button hides
 *   it, remembered per browser.
 * - From 768 to 1099 px the column is a drawer over the view and the view
 *   switch is a row under the header.
 * - Below 768 px the drawer stays, the week is a strip of seven day chips over
 *   an agenda (the time grid stays in Day), a bottom bar holds the views,
 *   Create floats above it, and a sideways swipe on the view steps it (the
 *   phone's bar has no room for ‹ ›).
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
  const wide = useIsWide();
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
  const agenda = !desktop && place.kind === "view" && place.view === "week";

  const barLayout: BarLayout = wide ? "wide" : desktop ? "tablet" : "phone";
  const drawerShown = !wide && drawerOpen;
  const sidebar = (
    <Sidebar
      date={date}
      today={today}
      showDay={desktop}
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
        <YearView
          year={place.date.year}
          onOpenDay={(day) => go("day", day)}
          onOpenMonth={(first) => go("month", first)}
        />
      ) : shown === "week" && !desktop ? (
        <WeekAgenda date={place.date} today={today} onNavigate={go} />
      ) : (
        <Suspense fallback={<div />}>
          <CalendarArea view={shown} date={place.date} onNavigate={go} />
        </Suspense>
      );
  }

  return (
    <div
      className={cn(
        "flex h-dvh flex-col overflow-hidden bg-ground",
        !desktop && "pt-[env(safe-area-inset-top)] leading-phone",
      )}
    >
      <a
        className="fixed top-3 left-3 z-[calc(var(--z-index-toast)+1)] translate-y-[calc(-100%-24px)] rounded-control bg-surface px-3.5 py-2.5 font-semibold no-underline focus-visible:translate-y-0 focus-visible:shadow-float"
        href="#main"
      >
        Skip to the calendar
      </a>
      <div className="flex-none">
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
          layout={barLayout}
          sidebarOpen={wide ? columnOpen : drawerShown}
          menuButtonRef={menuButton}
          onMenu={() => {
            if (wide) {
              writeColumnPref(!columnOpen);
              setColumnOpen(!columnOpen);
            } else setDrawerOpen(true);
          }}
          onToday={() => go(view, today)}
          onStep={(by) => go(view, stepDate(view, date, by))}
        />
      </div>
      <div className="flex min-h-0 flex-1">
        {wide && (
          <aside
            id="sidebar"
            className="w-[calc(var(--width-sidebar)+28px)] flex-none overflow-y-auto overscroll-contain pt-4 pb-7 pl-7"
            aria-label="Calendars"
            hidden={!columnOpen}
          >
            {sidebar}
          </aside>
        )}
        <main
          ref={mainRef}
          id="main"
          className={cn(
            "flex min-w-0 flex-1 flex-col overflow-auto focus:outline-none",
            desktop ? "p-4" : "p-2",
            wide && "pt-3 pr-7 pb-1",
            wide && !columnOpen && "pl-7",
            agenda && "p-0",
          )}
          tabIndex={-1}
        >
          {main}
        </main>
      </div>
      <Drawer open={drawerShown} onClose={closeDrawer} returnFocus={menuButton}>
        {sidebar}
      </Drawer>
      {!desktop && (
        <>
          {!drawerShown && (
            <button
              type="button"
              className="fixed right-[max(16px,env(safe-area-inset-right))] bottom-[calc(var(--height-bottom-bar)+max(16px,env(safe-area-inset-bottom))+16px)] z-bar flex h-13 items-center justify-center gap-2 rounded-[14px] bg-accent pr-5 pl-4 text-action-large font-semibold text-on-accent shadow-card hover:bg-accent-press active:bg-accent-press max-[379px]:size-14 max-[379px]:rounded-[16px] max-[379px]:p-0"
              aria-label="Create"
              aria-keyshortcuts="c"
              onClick={() => editor.openCreate()}
            >
              <PlusIcon size={24} />
              <span className="max-[379px]:hidden">Create</span>
            </button>
          )}
          <div className="flex-none">
            <ViewBar view={place.kind === "view" ? place.view : null} date={date} />
          </div>
        </>
      )}
      <Toaster />
    </div>
  );
}
