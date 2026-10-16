import type { Temporal } from "temporal-polyfill";
import { CaretDownIcon } from "../components/icons";
import { Link } from "../components/Link";
import { Menu } from "../components/Menu";
import { VIEWS, VIEW_LABELS, type View } from "../dates";
import { navigate, viewRoute } from "../router";

/** Each view's key, shown beside it in the menu as Google does. */
const KEY_OF: Readonly<Record<View, string>> = { day: "D", week: "W", month: "M", year: "Y" };

export interface ViewSwitcherProps {
  /** The view on screen; `null` on the search results. */
  view: View | null;
  /** The date the views open on: the one on screen, kept across views. */
  date: Temporal.PlainDate;
  /** The phone's menu instead of the desktop's row of four. */
  compact: boolean;
}

/**
 * Day, Week, Month, Year. On the desktop a row of four links (each a real
 * address, so a middle click opens the view in a new tab); on a phone a menu
 * under a button naming the view.
 */
export function ViewSwitcher({ view, date, compact }: ViewSwitcherProps) {
  if (compact) {
    return (
      <Menu
        label="View"
        triggerLabel={view ? `View: ${VIEW_LABELS[view]}` : "View"}
        triggerClassName="view-menu"
        align="end"
        trigger={
          <>
            <span>{view ? VIEW_LABELS[view] : "View"}</span>
            <CaretDownIcon size={18} />
          </>
        }
        sections={[
          {
            items: VIEWS.map((each) => ({
              label: VIEW_LABELS[each],
              selected: each === view,
              onSelect: () => navigate(viewRoute(each, date)),
            })),
          },
        ]}
      />
    );
  }
  return (
    <nav className="view-switcher" aria-label="View">
      {VIEWS.map((each) => (
        <Link
          key={each}
          to={viewRoute(each, date)}
          className="view-switcher__item"
          aria-current={each === view ? "page" : undefined}
          aria-keyshortcuts={KEY_OF[each].toLowerCase()}
          title={`${VIEW_LABELS[each]} (${KEY_OF[each]})`}
          data-label={VIEW_LABELS[each]}
        >
          {VIEW_LABELS[each]}
        </Link>
      ))}
    </nav>
  );
}
