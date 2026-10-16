import { useCallback, useSyncExternalStore } from "react";

/**
 * Phone or desktop, for the few components that lay out differently (the
 * login page's focus, the password dialog's sheet). Here rather than in
 * `layout/` (brief 05's) because the sign-in screens need it first; the
 * stylesheets use the same split as `max-width: 767.98px`.
 */

/** From here up the layout is the desktop one. */
export const DESKTOP_QUERY = "(min-width: 768px)";

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
