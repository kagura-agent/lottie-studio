// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useMediaQuery, useIsMobile, useIsTablet } from "@/hooks/useMediaQuery";

type ChangeHandler = (e: MediaQueryListEvent) => void;

function createMockMatchMedia() {
  const listeners = new Map<string, Set<ChangeHandler>>();
  const states = new Map<string, boolean>();

  const matchMedia = vi.fn((query: string): MediaQueryList => {
    if (!listeners.has(query)) {
      listeners.set(query, new Set());
    }
    return {
      matches: states.get(query) ?? false,
      media: query,
      onchange: null,
      addEventListener: vi.fn((_event: string, cb: ChangeHandler) => {
        listeners.get(query)!.add(cb);
      }) as any,
      removeEventListener: vi.fn((_event: string, cb: ChangeHandler) => {
        listeners.get(query)!.delete(cb);
      }) as any,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(() => true),
    };
  });

  function setMatch(query: string, matches: boolean) {
    states.set(query, matches);
    const cbs = listeners.get(query);
    if (cbs) {
      for (const cb of cbs) {
        cb({ matches, media: query } as MediaQueryListEvent);
      }
    }
  }

  return { matchMedia, setMatch, listeners };
}

describe("useMediaQuery SSR", () => {
  it("server snapshot returns false via renderToString", async () => {
    const React = await import("react");
    const { renderToString } = await import("react-dom/server");
    function TestComponent() {
      const match = useMediaQuery("(min-width: 768px)");
      return React.createElement("span", null, String(match));
    }
    const html = renderToString(React.createElement(TestComponent));
    expect(html).toContain("false");
  });
});

describe("useMediaQuery", () => {
  let mock: ReturnType<typeof createMockMatchMedia>;
  const originalMatchMedia = window.matchMedia;

  beforeEach(() => {
    mock = createMockMatchMedia();
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      configurable: true,
      value: mock.matchMedia,
    });
  });

  afterEach(() => {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      configurable: true,
      value: originalMatchMedia,
    });
  });

  it("returns false by default when query does not match", () => {
    const { result } = renderHook(() => useMediaQuery("(min-width: 768px)"));
    expect(result.current).toBe(false);
  });

  it("returns true when query matches", () => {
    mock.setMatch("(min-width: 768px)", true);
    const { result } = renderHook(() => useMediaQuery("(min-width: 768px)"));
    expect(result.current).toBe(true);
  });

  it("responds to matchMedia change events", () => {
    const { result } = renderHook(() => useMediaQuery("(min-width: 768px)"));
    expect(result.current).toBe(false);

    act(() => {
      mock.setMatch("(min-width: 768px)", true);
    });
    expect(result.current).toBe(true);

    act(() => {
      mock.setMatch("(min-width: 768px)", false);
    });
    expect(result.current).toBe(false);
  });

  it("cleanup removes listeners on unmount", () => {
    const { unmount } = renderHook(() => useMediaQuery("(min-width: 768px)"));
    expect(mock.listeners.get("(min-width: 768px)")!.size).toBeGreaterThan(0);

    unmount();
    expect(mock.listeners.get("(min-width: 768px)")!.size).toBe(0);
  });
});

describe("useIsMobile", () => {
  let mock: ReturnType<typeof createMockMatchMedia>;
  const originalMatchMedia = window.matchMedia;

  beforeEach(() => {
    mock = createMockMatchMedia();
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      configurable: true,
      value: mock.matchMedia,
    });
  });

  afterEach(() => {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      configurable: true,
      value: originalMatchMedia,
    });
  });

  it("uses max-width: 767px breakpoint", () => {
    renderHook(() => useIsMobile());
    expect(mock.matchMedia).toHaveBeenCalledWith("(max-width: 767px)");
  });

  it("returns true when viewport is mobile-sized", () => {
    mock.setMatch("(max-width: 767px)", true);
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(true);
  });
});

describe("useIsTablet", () => {
  let mock: ReturnType<typeof createMockMatchMedia>;
  const originalMatchMedia = window.matchMedia;

  beforeEach(() => {
    mock = createMockMatchMedia();
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      configurable: true,
      value: mock.matchMedia,
    });
  });

  afterEach(() => {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      configurable: true,
      value: originalMatchMedia,
    });
  });

  it("uses max-width: 1023px breakpoint", () => {
    renderHook(() => useIsTablet());
    expect(mock.matchMedia).toHaveBeenCalledWith("(max-width: 1023px)");
  });

  it("returns true when viewport is tablet-sized", () => {
    mock.setMatch("(max-width: 1023px)", true);
    const { result } = renderHook(() => useIsTablet());
    expect(result.current).toBe(true);
  });
});
