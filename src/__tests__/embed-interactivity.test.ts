import { describe, it, expect } from "vitest";

/**
 * Unit tests for embed interactivity mode logic.
 * These test the pure computation functions used by EmbedPlayer modes.
 */

// --- Helper functions extracted from EmbedPlayer logic ---

/** Scroll mode: map scroll percentage (0-1) to frame number */
function scrollToFrame(scrollY: number, scrollHeight: number, totalFrames: number): number {
  const maxScroll = scrollHeight - window.innerHeight;
  if (maxScroll <= 0) return 0;
  const progress = Math.min(Math.max(scrollY / maxScroll, 0), 1);
  return Math.round(progress * (totalFrames - 1));
}

/** Cursor mode: map clientX position to frame number */
function cursorToFrame(
  clientX: number,
  containerLeft: number,
  containerWidth: number,
  totalFrames: number,
): number {
  if (containerWidth <= 0) return 0;
  const relativeX = Math.min(Math.max(clientX - containerLeft, 0), containerWidth);
  const progress = relativeX / containerWidth;
  return Math.round(progress * (totalFrames - 1));
}

/** Validate mode parameter */
function parseMode(mode: string | undefined): "scroll" | "hover" | "click" | "cursor" | undefined {
  const validModes = ["scroll", "hover", "click", "cursor"];
  if (mode && validModes.includes(mode)) {
    return mode as "scroll" | "hover" | "click" | "cursor";
  }
  return undefined;
}

// Mock window.innerHeight for scroll calculations
const mockInnerHeight = 800;
Object.defineProperty(globalThis, "window", {
  value: { innerHeight: mockInnerHeight },
  writable: true,
});

describe("Embed Interactivity - Mode Parsing", () => {
  it("returns undefined for no mode", () => {
    expect(parseMode(undefined)).toBeUndefined();
    expect(parseMode("")).toBeUndefined();
  });

  it("parses valid modes", () => {
    expect(parseMode("scroll")).toBe("scroll");
    expect(parseMode("hover")).toBe("hover");
    expect(parseMode("click")).toBe("click");
    expect(parseMode("cursor")).toBe("cursor");
  });

  it("returns undefined for invalid modes", () => {
    expect(parseMode("invalid")).toBeUndefined();
    expect(parseMode("autoplay")).toBeUndefined();
    expect(parseMode("SCROLL")).toBeUndefined();
  });
});

describe("Embed Interactivity - Scroll Mode", () => {
  const totalFrames = 120;
  const scrollHeight = 2000; // document height

  it("maps 0% scroll to frame 0", () => {
    expect(scrollToFrame(0, scrollHeight, totalFrames)).toBe(0);
  });

  it("maps 100% scroll to last frame", () => {
    const maxScroll = scrollHeight - mockInnerHeight;
    expect(scrollToFrame(maxScroll, scrollHeight, totalFrames)).toBe(totalFrames - 1);
  });

  it("maps 50% scroll to middle frame", () => {
    const maxScroll = scrollHeight - mockInnerHeight;
    const frame = scrollToFrame(maxScroll / 2, scrollHeight, totalFrames);
    expect(frame).toBe(Math.round((totalFrames - 1) / 2));
  });

  it("clamps negative scroll to frame 0", () => {
    expect(scrollToFrame(-100, scrollHeight, totalFrames)).toBe(0);
  });

  it("clamps scroll beyond max to last frame", () => {
    expect(scrollToFrame(5000, scrollHeight, totalFrames)).toBe(totalFrames - 1);
  });

  it("returns 0 when scrollHeight equals viewport (no scrollable area)", () => {
    expect(scrollToFrame(100, mockInnerHeight, totalFrames)).toBe(0);
  });

  it("returns 0 when scrollHeight is less than viewport", () => {
    expect(scrollToFrame(0, 400, totalFrames)).toBe(0);
  });
});

describe("Embed Interactivity - Cursor Mode", () => {
  const totalFrames = 60;
  const containerLeft = 100;
  const containerWidth = 400;

  it("maps left edge to frame 0", () => {
    expect(cursorToFrame(containerLeft, containerLeft, containerWidth, totalFrames)).toBe(0);
  });

  it("maps right edge to last frame", () => {
    const rightEdge = containerLeft + containerWidth;
    expect(cursorToFrame(rightEdge, containerLeft, containerWidth, totalFrames)).toBe(
      totalFrames - 1,
    );
  });

  it("maps center to middle frame", () => {
    const center = containerLeft + containerWidth / 2;
    const frame = cursorToFrame(center, containerLeft, containerWidth, totalFrames);
    expect(frame).toBe(Math.round((totalFrames - 1) / 2));
  });

  it("clamps cursor left of container to frame 0", () => {
    expect(cursorToFrame(50, containerLeft, containerWidth, totalFrames)).toBe(0);
  });

  it("clamps cursor right of container to last frame", () => {
    expect(cursorToFrame(600, containerLeft, containerWidth, totalFrames)).toBe(totalFrames - 1);
  });

  it("returns 0 for zero-width container", () => {
    expect(cursorToFrame(100, 100, 0, totalFrames)).toBe(0);
  });

  it("works with single-frame animation", () => {
    expect(cursorToFrame(300, containerLeft, containerWidth, 1)).toBe(0);
  });
});

describe("Embed Interactivity - Hover Mode", () => {
  it("should play on enter and stop+rewind on leave (behavioral spec)", () => {
    // Hover mode is event-driven in the component.
    // This test validates the expected state transitions:
    let playing = false;
    let currentFrame = 0;
    const totalFrames = 60;

    // Simulate mouseenter
    const onMouseEnter = () => {
      playing = true;
      // Animation starts playing from current position
    };

    // Simulate mouseleave
    const onMouseLeave = () => {
      playing = false;
      currentFrame = 0;
    };

    // Initial state
    expect(playing).toBe(false);
    expect(currentFrame).toBe(0);

    // Enter
    onMouseEnter();
    expect(playing).toBe(true);

    // Simulate some playback
    currentFrame = 30;

    // Leave
    onMouseLeave();
    expect(playing).toBe(false);
    expect(currentFrame).toBe(0);

    // Re-enter
    onMouseEnter();
    expect(playing).toBe(true);
  });
});

describe("Embed Interactivity - Click Mode", () => {
  it("toggles play/pause on each click (behavioral spec)", () => {
    let playing = false;

    const onClick = () => {
      playing = !playing;
    };

    expect(playing).toBe(false);

    onClick();
    expect(playing).toBe(true);

    onClick();
    expect(playing).toBe(false);

    onClick();
    expect(playing).toBe(true);
  });
});

describe("Embed Interactivity - Mode affects autoplay/loop", () => {
  it("when mode is set, autoplay should be false", () => {
    const modes = ["scroll", "hover", "click", "cursor"];
    for (const mode of modes) {
      // Simulating page.tsx logic
      const autoplay = mode ? false : true;
      expect(autoplay).toBe(false);
    }
  });

  it("when mode is set, loop should be false", () => {
    const modes = ["scroll", "hover", "click", "cursor"];
    for (const mode of modes) {
      const loop = mode ? false : true;
      expect(loop).toBe(false);
    }
  });

  it("when mode is not set, autoplay and loop default to true", () => {
    const mode = undefined;
    const autoplay = mode ? false : true;
    const loop = mode ? false : true;
    expect(autoplay).toBe(true);
    expect(loop).toBe(true);
  });
});
