// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

type ChangeHandler = (e: MediaQueryListEvent) => void;

const QUERY = "(prefers-reduced-motion: reduce)";

function createMockMatchMedia() {
  const listeners = new Set<ChangeHandler>();
  let matches = false;

  const matchMedia = vi.fn((): MediaQueryList => ({
    matches,
    media: QUERY,
    onchange: null,
    addEventListener: vi.fn((_event: string, cb: ChangeHandler) => {
      listeners.add(cb);
    }) as any,
    removeEventListener: vi.fn((_event: string, cb: ChangeHandler) => {
      listeners.delete(cb);
    }) as any,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(() => true),
  }));

  function setReducedMotion(value: boolean) {
    matches = value;
    for (const cb of listeners) {
      cb({ matches: value, media: QUERY } as MediaQueryListEvent);
    }
  }

  return { matchMedia, setReducedMotion, listeners };
}

describe("useReducedMotion", () => {
  let mock: ReturnType<typeof createMockMatchMedia>;
  const originalMatchMedia = window.matchMedia;

  beforeEach(() => {
    mock = createMockMatchMedia();
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      configurable: true,
      value: mock.matchMedia,
    });
    vi.resetModules();
  });

  afterEach(() => {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      configurable: true,
      value: originalMatchMedia,
    });
  });

  it("returns false by default (no reduced motion preference)", async () => {
    const { useReducedMotion } = await import("@/hooks/useReducedMotion");
    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(false);
  });

  it("returns true when prefers-reduced-motion: reduce matches", async () => {
    mock.setReducedMotion(true);
    const { useReducedMotion } = await import("@/hooks/useReducedMotion");
    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(true);
  });

  it("responds to changes in motion preference", async () => {
    const { useReducedMotion } = await import("@/hooks/useReducedMotion");
    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(false);

    act(() => {
      mock.setReducedMotion(true);
    });
    expect(result.current).toBe(true);

    act(() => {
      mock.setReducedMotion(false);
    });
    expect(result.current).toBe(false);
  });

  it("server snapshot returns false (SSR)", async () => {
    const React = await import("react");
    const { renderToString } = await import("react-dom/server");
    const { useReducedMotion } = await import("@/hooks/useReducedMotion");

    function TestComponent() {
      const reduced = useReducedMotion();
      return React.createElement("span", null, String(reduced));
    }

    const html = renderToString(React.createElement(TestComponent));
    expect(html).toContain("false");
  });

  it("cleanup removes listener on unmount", async () => {
    const { useReducedMotion } = await import("@/hooks/useReducedMotion");
    const { unmount } = renderHook(() => useReducedMotion());
    expect(mock.listeners.size).toBeGreaterThan(0);

    unmount();
    expect(mock.listeners.size).toBe(0);
  });
});
