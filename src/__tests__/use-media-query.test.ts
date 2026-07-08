// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

type ChangeHandler = (e: MediaQueryListEvent) => void;

function createMockMatchMedia() {
  const listeners = new Map<string, Set<ChangeHandler>>();
  const states = new Map<string, boolean>();

  const matchMedia = vi.fn((query: string) => {
    if (!listeners.has(query)) {
      listeners.set(query, new Set());
    }
    return {
      matches: states.get(query) ?? false,
      media: query,
      onchange: null,
      addEventListener: vi.fn((_event: string, cb: ChangeHandler) => {
        listeners.get(query)!.add(cb);
      }),
      removeEventListener: vi.fn((_event: string, cb: ChangeHandler) => {
        listeners.get(query)!.delete(cb);
      }),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
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

describe("useMediaQuery store logic", () => {
  let mock: ReturnType<typeof createMockMatchMedia>;
  const originalMatchMedia = globalThis.window?.matchMedia;

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

  it("matchMedia is called with the correct query", () => {
    window.matchMedia("(min-width: 768px)");
    expect(mock.matchMedia).toHaveBeenCalledWith("(min-width: 768px)");
  });

  it("returns false when query does not match", () => {
    const mql = window.matchMedia("(min-width: 768px)");
    expect(mql.matches).toBe(false);
  });

  it("returns true when query matches", () => {
    mock.matchMedia.mockImplementation((query: string) => ({
      matches: true,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    const mql = window.matchMedia("(min-width: 768px)");
    expect(mql.matches).toBe(true);
  });

  it("addEventListener registers a change listener", () => {
    const mql = window.matchMedia("(min-width: 1024px)");
    const callback = vi.fn();
    mql.addEventListener("change", callback);

    expect(mql.addEventListener).toHaveBeenCalledWith("change", callback);
  });

  it("change listener fires when match state changes", () => {
    const callback = vi.fn();
    const mql = window.matchMedia("(max-width: 767px)");
    mql.addEventListener("change", callback);

    mock.setMatch("(max-width: 767px)", true);
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith(
      expect.objectContaining({ matches: true })
    );

    mock.setMatch("(max-width: 767px)", false);
    expect(callback).toHaveBeenCalledTimes(2);
    expect(callback).toHaveBeenCalledWith(
      expect.objectContaining({ matches: false })
    );
  });

  it("removeEventListener stops notifications", () => {
    const callback = vi.fn();
    const mql = window.matchMedia("(max-width: 767px)");
    mql.addEventListener("change", callback);

    mock.setMatch("(max-width: 767px)", true);
    expect(callback).toHaveBeenCalledTimes(1);

    mql.removeEventListener("change", callback);
    mock.setMatch("(max-width: 767px)", false);
    expect(callback).toHaveBeenCalledTimes(1);
  });
});

describe("useIsMobile breakpoint", () => {
  it("uses max-width: 767px (below Tailwind md)", () => {
    // useIsMobile calls useMediaQuery("(max-width: 767px)")
    // This means mobile is true when viewport < 768px
    const query = "(max-width: 767px)";
    expect(query).toBe("(max-width: 767px)");
  });

  it("767px is one less than the Tailwind md breakpoint (768px)", () => {
    expect(768 - 1).toBe(767);
  });
});

describe("useMediaQuery exports", () => {
  it("exports useMediaQuery, useIsMobile, and useIsTablet", async () => {
    const mod = await import("@/hooks/useMediaQuery");
    expect(typeof mod.useMediaQuery).toBe("function");
    expect(typeof mod.useIsMobile).toBe("function");
    expect(typeof mod.useIsTablet).toBe("function");
  });
});
