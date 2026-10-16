import type { Ref } from "react";
import type { Temporal } from "temporal-polyfill";
import { AppMark, CalendarPageIcon, ChevronLeftIcon, ChevronRightIcon, MenuIcon } from "../components/icons";
import { Link } from "../components/Link";
import { formatDayLong, type View } from "../dates";
import { HOME } from "../router";
import { SearchBox } from "../search/SearchBox";
import { AccountMenu } from "./AccountMenu";
import { ViewSwitcher } from "./ViewSwitcher";

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
    <header className={compact ? "topbar topbar--compact" : "topbar"}>
      <div className="topbar__start">
        <button
          ref={menuButtonRef}
          type="button"
          className="icon-button"
          aria-label="Main menu"
          aria-expanded={sidebarOpen}
          aria-controls="sidebar"
          onClick={onMenu}
        >
          <MenuIcon />
        </button>
        {!compact && (
          <Link to={HOME} className="topbar__brand" aria-label="Almanac, today">
            <AppMark size={40} />
            <span className="topbar__name">Almanac</span>
          </Link>
        )}
      </div>

      <div className="topbar__nav">
        {!compact && (
          <button type="button" className="today-button" title={formatDayLong(today)} aria-keyshortcuts="t" onClick={onToday}>
            Today
          </button>
        )}
        {view !== null && !compact && (
          <div className="topbar__steps">
            <button type="button" className="icon-button" aria-label={`Previous ${unit}`} aria-keyshortcuts="k" onClick={() => onStep(-1)}>
              <ChevronLeftIcon />
            </button>
            <button type="button" className="icon-button" aria-label={`Next ${unit}`} aria-keyshortcuts="j" onClick={() => onStep(1)}>
              <ChevronRightIcon />
            </button>
          </div>
        )}
        <h1 className="topbar__title" aria-live="polite">
          {title}
        </h1>
      </div>

      <div className="topbar__end">
        <SearchBox />
        {compact && (
          <button type="button" className="icon-button" aria-label={`Today, ${formatDayLong(today)}`} onClick={onToday}>
            <CalendarPageIcon />
            <span className="today-icon__number" aria-hidden="true">
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
