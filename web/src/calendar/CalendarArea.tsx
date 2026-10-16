import type { EditScope, Occurrence } from "@almanac/shared";
import FullCalendar, {
  type CalendarApi,
  type CalendarOptions,
  type CalendarRef,
  type DateSelectInfo,
  type EventChangeInfo,
  type EventClickInfo,
  type EventInput,
  type EventSourceFuncInfo,
  type MoreLinkHandler,
  type PluginInput,
} from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/react/daygrid";
import interactionPlugin from "@fullcalendar/react/interaction";
import enGbLocale from "@fullcalendar/react/locales/en-gb";
import timeGridPlugin from "@fullcalendar/react/timegrid";
import monarchTheme from "@fullcalendar/react/themes/monarch";
import "@fullcalendar/react/skeleton.css";
import "@fullcalendar/react/themes/monarch/theme.css";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { isApiError } from "../api";
import { showToast } from "../components/Toast";
import { currentCalendars, useCalendars } from "../data/calendars";
import { fetchOccurrences, onOccurrencesChanged, updateEvent } from "../data/occurrences";
import { useSettings } from "../data/settings";
import { Temporal, VIEW_LABELS, dateKey, wireInstant, type CalendarView, type View } from "../dates";
import { DetailsPopover } from "../event/DetailsPopover";
import { useEventEditor, type EventEditor } from "../event/EventEditor";
import { askScope } from "../event/scope";
import { dayHeaderContent, eventContent, eventTimeText, slotLabel } from "./content";
import {
  VIEW_TYPES,
  clickEnd,
  moveChanges,
  occurrenceOf,
  occurrencePatch,
  plainDateOf,
  toEventInputs,
  wireSpan,
} from "./events";
import { holdSelection } from "./selection";
import "./calendar.css";

export interface CalendarAreaProps {
  view: CalendarView;
  date: Temporal.PlainDate;
  /** FullCalendar's own navigation (a day number, "2 more") reports back here; the shell moves the address. */
  onNavigate(view: View, date: Temporal.PlainDate): void;
}

/**
 * Day, week and month: FullCalendar v7 with its Monarch theme (Material,
 * the closest to Google Calendar) in Almanac's colours (calendar.css).
 *
 * - The address is the truth: the view and date come from the props and the
 *   calendar follows them; a day number or "2 more" asks the shell to move
 *   the address instead of moving the calendar itself.
 * - Events come from `GET /api/occurrences` for the range on screen, drawn
 *   in the display time zone, only for visible calendars, in each
 *   calendar's colour; every write anywhere (`onOccurrencesChanged`) makes
 *   it fetch again.
 * - A click or drag on empty time opens quick create beside the selection;
 *   a click on an event opens its details; dragging or resizing an event
 *   saves it, asking the edit scope first for a series.
 * - On a phone the shell's sideways swipe steps the view. FullCalendar's
 *   touch drags start with a long press (1 s), longer than any swipe
 *   (`layout/swipe.ts` ignores touches over 600 ms), and every event is
 *   marked `data-no-swipe`, so a quick flick that starts on an (already
 *   selected, so instantly draggable) event moves only the event.
 */
export function CalendarArea({ view, date, onNavigate }: CalendarAreaProps) {
  const { timeZone } = useSettings();
  const { calendars } = useCalendars();
  const editor = useEventEditor();
  const calendarRef = useRef<CalendarRef>(null);
  const rootRef = useRef<HTMLElement>(null);
  const [details, setDetails] = useState<Details | null>(null);
  // The details close when the view moves on (and stay closed on coming back).
  const place = `${view}/${dateKey(date)}`;
  const [shownAt, setShownAt] = useState(place);
  if (shownAt !== place) {
    setShownAt(place);
    setDetails(null);
  }

  // What FullCalendar's callbacks read when they run; they themselves never change, so FullCalendar never refetches for a new function.
  const latest = useRef<Latest>({ onNavigate, editor, timeZone });
  useLayoutEffect(() => {
    latest.current = { onNavigate, editor, timeZone };
  });

  // FullCalendar asks for its events while it renders, and takes the answer
  // as a state update of its own. The first time the view loads (lazily: React
  // renders it in slices, letting other work run between them) the answer can
  // come before that render is on the screen, and React refuses an update to
  // a component that hasn't mounted. So the request goes at once and the
  // answer waits for the mount. A render React throws away never mounts, and
  // its answer is never given.
  const [mounted] = useState(createGate);
  useEffect(() => mounted.open(), [mounted]);

  // The occurrences of the range on screen, kept until a write anywhere: a
  // calendar shown, hidden or recoloured draws them again without a fetch,
  // and two asks for one range share one request.
  const fetched = useRef<{ key: string; request: Promise<Occurrence[]> } | null>(null);
  const events = useCallback(
    async (info: EventSourceFuncInfo): Promise<EventInput[]> => {
      const from = wireInstant(Temporal.Instant.fromEpochMilliseconds(info.start.getTime()));
      const to = wireInstant(Temporal.Instant.fromEpochMilliseconds(info.end.getTime()));
      const key = `${from}/${to}`;
      if (fetched.current?.key !== key) fetched.current = { key, request: fetchOccurrences(from, to) };
      const kept = fetched.current;
      try {
        const occurrences = await kept.request;
        await mounted.opened;
        return toEventInputs(occurrences, currentCalendars());
      } catch (error) {
        if (fetched.current === kept) fetched.current = null;
        await mounted.opened;
        throw error;
      }
    },
    [mounted],
  );

  const api = useCallback((): CalendarApi | null => calendarRef.current?.getApi() ?? null, []);

  // The address moved: follow it.
  useEffect(() => {
    const calendar = api();
    if (!calendar) return;
    const type = VIEW_TYPES[view];
    if (calendar.view.type !== type) calendar.changeView(type, dateKey(date));
    else calendar.gotoDate(dateKey(date));
  }, [api, view, date]);

  // A write anywhere: fetch the range again.
  useEffect(
    () =>
      onOccurrencesChanged(() => {
        fetched.current = null;
        api()?.refetchEvents();
      }),
    [api],
  );

  // The calendars (shown, hidden, recoloured, loaded) or the zone changed: draw again.
  // Not on mount, where FullCalendar has just asked for its events itself.
  const drawn = useRef(false);
  useEffect(() => {
    if (drawn.current) api()?.refetchEvents();
    drawn.current = true;
  }, [api, calendars, timeZone]);

  // Quick create lets the selection go through `releaseSelection()`.
  useEffect(() => holdSelection(() => api()?.unselect()), [api]);

  // A press on the shaded selection (month, the all-day row) is quick
  // create's own: FullCalendar selects the same span again and the editor
  // keeps quick create as it is, so the popover must not take the press for
  // one outside it and close first. The day's number row is drawn over the
  // shading, so the press goes by where it lands, not by what it lands on;
  // events, links and buttons in the shading keep their own presses.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest("[data-no-swipe], a, button, [role=button], [role=link]")) return;
      if (onSelection(root, event.clientX, event.clientY)) event.stopPropagation();
    };
    root.addEventListener("pointerdown", onPointerDown);
    return () => root.removeEventListener("pointerdown", onPointerDown);
  }, []);

  // FullCalendar's callbacks: made once, reading the props of the moment through `latest`.
  const select = useCallback((info: DateSelectInfo) => selectionMade(info, latest.current, rootRef.current), []);
  const eventClick = useCallback((info: EventClickInfo) => {
    info.jsEvent.preventDefault();
    const occurrence = occurrenceOf(info.event);
    if (occurrence) setDetails({ occurrence, anchor: info.el });
  }, []);
  const eventMoved = useCallback((info: EventChangeInfo) => void saveMove(info, latest.current.timeZone), []);
  const closeDetails = useCallback(() => setDetails(null), []);
  const navLinkDayClick = useCallback((day: Date) => {
    latest.current.onNavigate("day", plainDateOf(day, latest.current.timeZone));
  }, []);
  // "2 more": that day in the day view. FullCalendar goes there too, and the address agrees once the shell has moved it.
  const moreLinkClick = useCallback((info: Parameters<MoreLinkHandler>[0]) => {
    latest.current.onNavigate("day", plainDateOf(info.date, latest.current.timeZone));
    return VIEW_TYPES.day;
  }, []);
  const fetchFailed = useCallback((error: unknown) => fetchFailure(error, () => api()?.refetchEvents()), [api]);

  return (
    <section ref={rootRef} className="calendar-area" aria-label={`${VIEW_LABELS[view]} view`} data-view={view}>
      <FullCalendar
        ref={calendarRef}
        plugins={PLUGINS}
        {...OPTIONS}
        initialView={VIEW_TYPES[view]}
        initialDate={dateKey(date)}
        timeZone={timeZone}
        events={events}
        eventSourceFailure={fetchFailed}
        select={select}
        eventClick={eventClick}
        eventDrop={eventMoved}
        eventResize={eventMoved}
        eventDragStart={closeDetails}
        eventResizeStart={closeDetails}
        navLinkDayClick={navLinkDayClick}
        moreLinkClick={moreLinkClick}
      />
      {details && (
        <DetailsPopover occurrence={details.occurrence} anchor={details.anchor} onClose={() => setDetails(null)} />
      )}
    </section>
  );
}

// --- Options that never change ----------------------------------------------------------------

const PLUGINS: PluginInput[] = [dayGridPlugin, timeGridPlugin, interactionPlugin, monarchTheme];

/** One 15-minute snap: what a click on the hours selects. */
const SNAP_MS = 15 * 60_000;

const OPTIONS: CalendarOptions = {
  locale: enGbLocale,
  firstDay: 1,
  headerToolbar: false,
  height: "100%",
  colorScheme: "light",
  className: "cal",
  // Flush with the page, as Google's grid is: no frame round the view.
  borderless: true,
  // Time: 30-minute rows labelled each hour, 15-minute snapping, a line at now.
  slotDuration: "00:30:00",
  snapDuration: "00:15:00",
  slotHeaderInterval: "01:00:00",
  slotHeaderFormat: slotLabel,
  slotHeaderInnerClass: "cal-slot-label",
  // Lines on the hours only, as Google draws them.
  slotLaneClass: (info) => (info.isMinor ? "cal-half-hour" : undefined),
  slotHeaderClass: (info) => (info.isMinor ? "cal-half-hour" : undefined),
  // Google's 48 px an hour, the same at every width. (FullCalendar measures the
  // labels first; rows that change height later would leave 08:00 scrolled wrong.)
  slotMinHeight: 24,
  // Opened at 08:00 with its label whole: the label sits across its hour's
  // line (calendar.css), so the top is 15 minutes (12 px) above the line.
  scrollTime: "07:45:00",
  scrollTimeReset: false,
  nowIndicator: true,
  // Events: titles and times end in "…" when they don't fit (calendar.css).
  eventTitleClass: "cal-event-title",
  eventTimeClass: "cal-event-time",
  // Day and week: Monarch keeps an event under 50 px to one line, title then
  // time. Google gives an hour (48 px) two, the title over the time, and two
  // lines take 44 px; from 45 minutes (36 px) down, one line.
  eventShortHeight: 40,
  eventContent,
  eventTimeFormat: eventTimeText,
  allDayText: "All day",
  allDayHeaderInnerClass: "cal-all-day",
  dayHeaderContent,
  // Month: only the weeks the month touches, "2 more" when a day is full.
  fixedWeekCount: false,
  moreLinkText: (count: number) => `${count} more`,
  navLinks: true,
  // Editing.
  editable: true,
  selectable: true,
  selectMirror: true,
  forceEventDuration: true,
  unselectCancel: "[role=dialog], dialog",
  highlightClass: "cal-highlight",
  eventClass: (info) => (info.isMirror ? "cal-mirror" : undefined),
  eventDidMount: (info) => {
    info.el.dataset.noSwipe = "";
  },
  views: {
    timeGrid: { dayHeaderFormat: { weekday: "short", day: "numeric" } },
    // The day view heads its one column from the left, as Google's does.
    timeGridDay: { dayHeaderAlign: "start" },
    // Month moves events between days; their length stays.
    dayGridMonth: { dayHeaderFormat: { weekday: "short" }, dayMaxEvents: true, eventDurationEditable: false },
  },
};

// --- What the callbacks do ----------------------------------------------------------------------

interface Latest {
  onNavigate: CalendarAreaProps["onNavigate"];
  editor: EventEditor;
  timeZone: string;
}

interface Details {
  occurrence: Occurrence;
  anchor: Element;
}

/**
 * A click or drag on empty time: quick create beside the selection. A click
 * on the hours selects one 15-minute snap; Google makes it an hour, so the
 * selection is widened first (which calls this again).
 */
function selectionMade(info: DateSelectInfo, latest: Latest, root: HTMLElement | null): void {
  const longer = clickEnd(info.start, info.end, info.allDay, SNAP_MS);
  if (longer !== null) {
    info.view.calendar.select({ start: info.start, end: longer, allDay: false });
    return;
  }
  const span = wireSpan(info.start, info.end, info.allDay, latest.timeZone);
  const pointer = pointerOf(info.jsEvent);
  // The selection is drawn by the next frame.
  requestAnimationFrame(() => {
    const anchor = selectionElement(root) ?? pointRect(pointer) ?? root?.getBoundingClientRect();
    if (anchor) latest.editor.openQuickCreate({ ...span, anchor });
  });
}

/** After a drag or resize: ask the scope for a series, then save; on Cancel or an error, put the event back. */
async function saveMove(info: EventChangeInfo, timeZone: string): Promise<void> {
  const occurrence = occurrenceOf(info.event);
  const start = info.event.start;
  if (!occurrence || !start) {
    info.revert();
    return;
  }
  const span = wireSpan(start, info.event.end, info.event.allDay, timeZone);
  let scope: EditScope | null = null;
  if (occurrence.seriesId !== null) {
    scope = await askScope({ action: "edit", allowThis: true });
    if (scope === null) {
      info.revert();
      return;
    }
  }
  try {
    // The answer comes back through `onOccurrencesChanged`: the range is fetched again.
    await updateEvent(occurrence.eventId, occurrencePatch(occurrence, moveChanges(occurrence, span), scope));
  } catch (error) {
    info.revert();
    if (!isApiError(error, "signed_out")) {
      showToast(isApiError(error) ? error.message : "The event couldn't be moved. Try again.");
    }
  }
}

function fetchFailure(error: unknown, retry: () => void): void {
  // Signed out: the login page takes over.
  if (isApiError(error, "signed_out")) return;
  showToast(isApiError(error) ? error.message : "Your events couldn't be loaded.", { action: { label: "Retry", onAction: retry } });
}

/** Where the pointer was let go, when FullCalendar says (a mouse or pen; not a selection made in code). */
function pointerOf(event: UIEvent | null): { x: number; y: number } | null {
  const at = event as Partial<MouseEvent> | null;
  return typeof at?.clientX === "number" && typeof at.clientY === "number" ? { x: at.clientX, y: at.clientY } : null;
}

/** The selection on screen: the mirror block in day and week, the first shaded cell in month and the all-day row. */
function selectionElement(root: HTMLElement | null): Element | null {
  return root?.querySelector(".cal-mirror") ?? root?.querySelector(".cal-highlight") ?? null;
}

/** Whether a point in the window is on the shaded selection (one shading per week it covers). */
function onSelection(root: HTMLElement, x: number, y: number): boolean {
  for (const shade of root.querySelectorAll(".cal-highlight")) {
    const box = shade.getBoundingClientRect();
    if (x >= box.left && x < box.right && y >= box.top && y < box.bottom) return true;
  }
  return false;
}

function pointRect(point: { x: number; y: number } | null): DOMRect | null {
  return point ? new DOMRect(point.x, point.y, 0, 0) : null;
}

/** A promise that settles when `open` is first called; later calls do nothing. */
function createGate(): { opened: Promise<void>; open: () => void } {
  let open = () => {};
  const opened = new Promise<void>((resolve) => {
    open = resolve;
  });
  return { opened, open };
}
