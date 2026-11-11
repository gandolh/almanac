import type { Ref } from "react";
import type { Temporal } from "temporal-polyfill";
import { AppMark, CalendarPageIcon, ChevronLeftIcon, ChevronRightIcon, MenuIcon } from "../components/icons";
import { Link } from "../components/Link";
import { formatDayLong, type View } from "../dates";
import { HOME } from "../router";
import { SearchBox } from "../search/SearchBox";
import { AccountMenu } from "./AccountMenu";
import { ViewSwitcher } from "./ViewSwitcher";
import { cn } from "../lib/cn";
import { ICON_BUTTON } from "../components/looks";

export interface TopBarProps {
  /** The view on screen; `null` on the search results, which have no ‹ ›. */
  view: View | null;
  /** The date the views are on. */
  date: Temporal.PlainDate;
  today: Temporal.PlainDate;
  /** The range on screen: "October 2026". */
  title: string;
  /** The phone's bar: no wordmark, Today as an icon, the views as a menu, no ‹ › (a swipe steps instead). */
  compact: boolean;
  /** Whether the left column (or the phone's drawer) is showing. */
  sidebarOpen: boolean;
  onMenu: () => void;
  onToday: () => void;
  onStep: (by: 1 | -1) => void;
  menuButtonRef?: Ref<HTMLButtonElement>;
}

/**
 * Google's top bar, 64 px: the menu button and the app's name, Today, ‹ ›
 * and the range; then search, the view switcher and the account button.
 */
export function TopBar(props: TopBarProps) {
  const { view, date, today, title, compact, sidebarOpen, onMenu, onToday, onStep, menuButtonRef } = props;
  const unit = view ?? "month";
  return (
    <header
      className={cn(
        "relative z-bar flex h-topbar items-center gap-2 border-b border-hairline bg-ground px-gutter-desktop",
        compact && "gap-1 px-1",
      )}
    >
      <div
        className={cn(
          "flex w-[calc(var(--width-sidebar)-var(--spacing-gutter-desktop)-8px)] flex-none items-center gap-1",
          compact && "w-auto",
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
        {!compact && (
          <Link
            to={HOME}
            className="flex min-w-0 items-center gap-2 rounded-control px-1 text-ink-2 no-underline hover:text-ink"
            aria-label="Almanac, today"
          >
            <AppMark size={40} />
            <span className="text-brand leading-tight font-regular whitespace-nowrap">Almanac</span>
          </Link>
        )}
      </div>

      <div className={cn("flex min-w-0 flex-1 items-center gap-2", compact && "gap-0")}>
        {!compact && (
          <button
            type="button"
            className="mr-2 min-h-outlined flex-none rounded-pill border border-outline bg-transparent px-4 text-meta font-medium text-ink transition-[background-color] duration-(--duration-fast) ease-out hover:bg-hover active:bg-press"
            title={formatDayLong(today)}
            aria-keyshortcuts="t"
            onClick={onToday}
          >
            Today
          </button>
        )}
        {view !== null && !compact && (
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
            "ml-1 min-w-0 overflow-hidden text-range leading-tight font-regular text-ellipsis whitespace-nowrap text-ink tabular-nums",
            compact && "ml-0.5 text-range-phone",
          )}
          aria-live="polite"
        >
          {title}
        </h1>
      </div>

      <div className={cn("flex flex-none items-center gap-2", compact && "gap-0.5")}>
        <SearchBox />
        {compact && (
          <button type="button" className={ICON_BUTTON} aria-label={`Today, ${formatDayLong(today)}`} onClick={onToday}>
            <CalendarPageIcon />
            <span
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[12%] text-badge leading-none font-bold tabular-nums"
              aria-hidden="true"
            >
              {today.day}
            </span>
          </button>
        )}
        <ViewSwitcher view={view} date={date} compact={compact} />
        <AccountMenu />
      </div>
    </header>
  );
}
