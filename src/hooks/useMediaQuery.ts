import { useSyncExternalStore } from "react";

/**
 * Custom hook that tracks a CSS media query match state.
 * Uses useSyncExternalStore for safe, tear-free reads.
 *
 * Note: The server snapshot returns false. This means conditional rendering
 * based on this hook may produce a brief flash on mobile after hydration.
 * For layout-critical classes, prefer pure CSS/Tailwind responsive utilities
 * (e.g. `md:flex-row`) over JS-based checks.
 */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (callback) => {
      if (typeof window === "undefined") return () => {};
      const mql = window.matchMedia(query);
      mql.addEventListener("change", callback);
      return () => mql.removeEventListener("change", callback);
    },
    () => {
      if (typeof window === "undefined") return false;
      return window.matchMedia(query).matches;
    },
    () => false // SSR snapshot — matches server render
  );
}

/**
 * Shortcut: returns true when viewport width < 768px.
 */
export function useIsMobile(): boolean {
  return useMediaQuery("(max-width: 767px)");
}

/**
 * Shortcut: returns true when viewport width < 1024px.
 */
export function useIsTablet(): boolean {
  return useMediaQuery("(max-width: 1023px)");
}
