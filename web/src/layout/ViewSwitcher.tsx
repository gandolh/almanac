import type { Temporal } from "temporal-polyfill";
import { Icon, type IconProps } from "../components/icons";
import { Link } from "../components/Link";
import { VIEWS, VIEW_LABELS, type View } from "../dates";
import { viewRoute } from "../router";
import { cn } from "../lib/cn";

/** Each view's key, shown in its tooltip. */
const KEY_OF: Readonly<Record<View, string>> = { day: "D", week: "W", month: "M", year: "Y" };

export interface ViewSwitcherProps {
  /** The view on screen; `null` on the search results. */
  view: View | null;
  /** The date the views open on: the one on screen, kept across views. */
  date: Temporal.PlainDate;
}

/**
 * Day, Week, Month, Year: a segmented switch of four links (each a real
 * address, so a middle click opens the view in a new tab). The chosen one
 * sits on the accent tint with an accent edge. In the header band from
 * 1100 px, in a row under it from 768 px; a phone has `ViewBar` instead.
 */
export function ViewSwitcher({ view, date }: ViewSwitcherProps) {
  return (
    <nav className="flex flex-none gap-0.5 rounded-[12px] border border-outline bg-surface p-0.5" aria-label="View">
      {VIEWS.map((each) => (
        <Link
          key={each}
          to={viewRoute(each, date)}
          className="inline-flex h-[30px] items-center justify-center rounded-[9px] px-3.5 text-meta leading-tight font-medium text-ink no-underline transition-[background-color] duration-(--duration-fast) ease-out hover:bg-field hover:text-ink aria-[current]:bg-accent-tint aria-[current]:font-semibold aria-[current]:text-accent-ink aria-[current]:shadow-[inset_0_0_0_1px_var(--color-accent)] aria-[current]:hover:bg-accent-tint"
          aria-current={each === view ? "page" : undefined}
          aria-keyshortcuts={KEY_OF[each].toLowerCase()}
          title={`${VIEW_LABELS[each]} (${KEY_OF[each]})`}
        >
          {VIEW_LABELS[each]}
        </Link>
      ))}
    </nav>
  );
}

const VIEW_ICONS: Readonly<Record<View, (props: IconProps) => React.JSX.Element>> = {
  day: (props) => (
    <Icon {...props}>
      <rect x="4" y="4.5" width="16" height="15" rx="2.5" />
      <path d="M4 9.5h16" />
    </Icon>
  ),
  week: (props) => (
    <Icon {...props}>
      <rect x="4" y="4.5" width="16" height="15" rx="2.5" />
      <path d="M9.3 4.5v15M14.7 4.5v15" />
    </Icon>
  ),
  month: (props) => (
    <Icon {...props}>
      <rect x="4" y="4.5" width="16" height="15" rx="2.5" />
      <path d="M4 9.5h16M9.3 9.5v10M14.7 9.5v10" />
    </Icon>
  ),
  year: (props) => (
    <Icon {...props}>
      <rect x="4" y="4" width="6.5" height="6.5" rx="1.5" />
      <rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5" />
      <rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5" />
      <rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5" />
    </Icon>
  ),
};

/**
 * The phone's bottom view bar: the four views as icon-over-word links, the
 * chosen one on the accent tint. It replaces the Week menu, and clears the
 * gesture area under it.
 */
export function ViewBar({ view, date, className }: ViewSwitcherProps & { className?: string }) {
  return (
    <nav
      className={cn(
        "flex h-[calc(var(--height-bottom-bar)+max(16px,env(safe-area-inset-bottom)))] gap-1 border-t border-hairline bg-surface px-2 pt-1 pb-[max(16px,env(safe-area-inset-bottom))] shadow-card",
        className,
      )}
      aria-label="View"
    >
      {VIEWS.map((each) => {
        const ViewIcon = VIEW_ICONS[each];
        return (
          <Link
            key={each}
            to={viewRoute(each, date)}
            className="flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 rounded-[14px] text-small leading-tight font-medium text-muted no-underline hover:text-ink aria-[current]:bg-accent-tint aria-[current]:font-semibold aria-[current]:text-accent-ink aria-[current]:shadow-[inset_0_0_0_1px_var(--color-accent)] aria-[current]:hover:text-accent-ink"
            aria-current={each === view ? "page" : undefined}
            aria-keyshortcuts={KEY_OF[each].toLowerCase()}
          >
            <ViewIcon size={22} />
            {VIEW_LABELS[each]}
          </Link>
        );
      })}
    </nav>
  );
}
