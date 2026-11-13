import { useCallback, useSyncExternalStore } from "react";

/**
 * Phone or desktop, for the few components that lay out differently (the
 * login page's focus, the password dialog's sheet). Here rather than in
 * `layout/` because the sign-in screens need it first; the
 * stylesheets use the same split as `max-width: 767.98px`.
 */

/** From here up the layout is the desktop one. */
export const DESKTOP_QUERY = "(min-width: 768px)";

/** From here up the left column sits beside the view (below it, the column is the drawer). */
export const WIDE_QUERY = "(min-width: 1100px)";

/** Whether a media query matches now; re-renders when that changes. */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    [query],
  );
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/** True on the desktop layout (768 px and wider), false on a phone. */
export function useIsDesktop(): boolean {
  return useMediaQuery(DESKTOP_QUERY);
}

/** True from 1100 px: the left column beside the view, the view switch in the header band. */
export function useIsWide(): boolean {
  return useMediaQuery(WIDE_QUERY);
}
