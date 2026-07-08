import { useState, useEffect, useCallback } from "react";

/**
 * Custom hook that tracks a CSS media query match state.
 * Returns true when the document matches the given query string.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const mql = window.matchMedia(query);
    setMatches(mql.matches);

    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, [query]);

  return matches;
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
