import type { Ref } from "react";
import type { Temporal } from "temporal-polyfill";
import { CalendarPageIcon, ChevronLeftIcon, ChevronRightIcon, MenuIcon } from "../components/icons";
import { Link } from "../components/Link";
import { formatDayLong, type View } from "../dates";
import { HOME } from "../router";
import { SearchBox } from "../search/SearchBox";
import { AccountMenu } from "./AccountMenu";
import { ViewSwitcher } from "./ViewSwitcher";
import { cn } from "../lib/cn";
import { ICON_BUTTON } from "../components/looks";

/** The three widths the header takes: from 1100 px (the switch in the band), 768 to 1099 (the switch in a row under it), a phone. */
export type BarLayout = "wide" | "tablet" | "phone";

export interface TopBarProps {
  /** The view on screen; `null` on the search results, which have no ‹ ›. */
  view: View | null;
  /** The date the views are on. */
  date: Temporal.PlainDate;
  today: Temporal.PlainDate;
  /** The range on screen: "9 – 15 Nov 2026". */
  title: string;
  layout: BarLayout;
  /** Whether the left column (or the drawer) is showing. */
  sidebarOpen: boolean;
  onMenu: () => void;
  onToday: () => void;
  onStep: (by: 1 | -1) => void;
  menuButtonRef?: Ref<HTMLButtonElement>;
}

/** The outlined button of the band (Today). */
const BAND_BUTTON =
  "inline-flex h-9 flex-none items-center justify-center rounded-control border border-outline bg-surface px-3.5 text-meta font-semibold whitespace-nowrap text-ink transition-[background-color] duration-(--duration-fast) ease-out hover:bg-field active:bg-control-press";

/**
 * The header band, 56 px, raised on `surface`: the menu button and the
 * wordmark, Today, ‹ › and the range; then search, the view switch (from
 * 1100 px) and the account button. Under 1100 px the switch is a row of its
 * own beneath. A phone's band has no wordmark and no ‹ › (a swipe steps the
 * view): the menu, the range, search, Today as an icon and the account.
 */
export function TopBar(props: TopBarProps) {
  const { view, date, today, title, layout, sidebarOpen, onMenu, onToday, onStep, menuButtonRef } = props;
  const unit = view ?? "month";
  const phone = layout === "phone";
  return (
    <>
      <header
        className={cn(
          "relative z-bar flex h-topbar items-center gap-2 border-b border-hairline bg-surface px-4 shadow-card",
          phone && "gap-1 px-2",
        )}
      >
        <button
          ref={menuButtonRef}
          type="button"
          className={ICON_BUTTON}
          aria-label="Main menu"
          aria-expanded={sidebarOpen}
          aria-controls="sidebar"
          onClick={onMenu}
        >
          <MenuIcon />
        </button>
        {!phone && (
          <Link
            to={HOME}
            className="mr-3 ml-1 rounded-control font-num text-brand leading-tight font-bold tracking-[0.01em] whitespace-nowrap text-ink no-underline hover:text-ink"
            aria-label="Almanac, today"
          >
            Almanac
          </Link>
        )}
        {!phone && (
          <button
            type="button"
            className={BAND_BUTTON}
            title={formatDayLong(today)}
            aria-keyshortcuts="t"
            onClick={onToday}
          >
            Today
          </button>
        )}
        {view !== null && !phone && (
          <div className="flex flex-none items-center">
            <button
              type="button"
              className={ICON_BUTTON}
              aria-label={`Previous ${unit}`}
              aria-keyshortcuts="k"
              onClick={() => onStep(-1)}
            >
              <ChevronLeftIcon />
            </button>
            <button
              type="button"
              className={ICON_BUTTON}
              aria-label={`Next ${unit}`}
              aria-keyshortcuts="j"
              onClick={() => onStep(1)}
            >
              <ChevronRightIcon />
            </button>
          </div>
        )}
        <h1
          className={cn(
            "ml-1 min-w-0 overflow-hidden font-num text-range leading-tight font-semibold text-ellipsis whitespace-nowrap text-ink tabular-nums",
            phone && "ml-1 flex-1 text-range-phone",
          )}
          aria-live="polite"
        >
          {title}
        </h1>
        {!phone && <div className="flex-1" />}
        <div className={cn("flex flex-none items-center gap-2", phone && "gap-0.5")}>
          <SearchBox wide={layout === "wide"} />
          {phone && (
            <button
              type="button"
              className={ICON_BUTTON}
              aria-label={`Today, ${formatDayLong(today)}`}
              onClick={onToday}
            >
              <CalendarPageIcon />
              <span
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[12%] font-num text-badge leading-none font-bold tabular-nums"
                aria-hidden="true"
              >
                {today.day}
              </span>
            </button>
          )}
          {layout === "wide" && <ViewSwitcher view={view} date={date} />}
          <AccountMenu />
        </div>
      </header>
      {layout === "tablet" && (
        <div className="flex flex-none px-4 pt-2.5">
          <ViewSwitcher view={view} date={date} />
        </div>
      )}
    </>
  );
}
