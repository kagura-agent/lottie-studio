// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import Controls from "@/components/Controls";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

function makeProps(overrides = {}) {
  return {
    isPlaying: false,
    onTogglePlay: vi.fn(),
    speed: 1,
    onSpeedChange: vi.fn(),
    loopConfig: { mode: "loop" as const },
    onLoopConfigChange: vi.fn(),
    currentFrame: 0,
    totalFrames: 60,
    onSeek: vi.fn(),
    frameRate: 30,
    onDurationChange: vi.fn(),
    ...overrides,
  };
}

describe("Play/pause button", () => {
  it("renders ▶ when not playing", () => {
    render(<Controls {...makeProps({ isPlaying: false })} />);
    const btn = screen.getByLabelText("Play animation");
    expect(btn.textContent).toBe("▶");
  });

  it("renders ⏸ when playing", () => {
    render(<Controls {...makeProps({ isPlaying: true })} />);
    const btn = screen.getByLabelText("Pause animation");
    expect(btn.textContent).toBe("⏸");
  });

  it("calls onTogglePlay on click", () => {
    const onTogglePlay = vi.fn();
    render(<Controls {...makeProps({ onTogglePlay })} />);
    fireEvent.click(screen.getByLabelText("Play animation"));
    expect(onTogglePlay).toHaveBeenCalledOnce();
  });
});

describe("Speed buttons", () => {
  it("renders all three speed options", () => {
    render(<Controls {...makeProps()} />);
    expect(screen.getByLabelText("Set playback speed to 0.5x")).toBeDefined();
    expect(screen.getByLabelText("Set playback speed to 1x")).toBeDefined();
    expect(screen.getByLabelText("Set playback speed to 2x")).toBeDefined();
  });

  it("calls onSpeedChange with correct value", () => {
    const onSpeedChange = vi.fn();
    render(<Controls {...makeProps({ onSpeedChange })} />);
    fireEvent.click(screen.getByLabelText("Set playback speed to 2x"));
    expect(onSpeedChange).toHaveBeenCalledWith(2);
  });

  it("marks active speed as pressed", () => {
    render(<Controls {...makeProps({ speed: 0.5 })} />);
    expect(screen.getByLabelText("Set playback speed to 0.5x").getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByLabelText("Set playback speed to 1x").getAttribute("aria-pressed")).toBe("false");
    expect(screen.getByLabelText("Set playback speed to 2x").getAttribute("aria-pressed")).toBe("false");
  });
});

describe("Loop mode popover", () => {
  it("toggles popover open and closed", () => {
    render(<Controls {...makeProps()} />);
    const btn = screen.getByLabelText("Loop mode");
    expect(btn.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(btn);
    expect(btn.getAttribute("aria-expanded")).toBe("true");
    fireEvent.click(btn);
    expect(btn.getAttribute("aria-expanded")).toBe("false");
  });

  it("calls onLoopConfigChange and closes popover for non-count mode", () => {
    const onLoopConfigChange = vi.fn();
    render(<Controls {...makeProps({ onLoopConfigChange })} />);
    fireEvent.click(screen.getByLabelText("Loop mode"));
    fireEvent.click(screen.getByText("once"));
    expect(onLoopConfigChange).toHaveBeenCalledWith({ mode: "once" });
    expect(screen.getByLabelText("Loop mode").getAttribute("aria-expanded")).toBe("false");
  });

  it("selecting count mode keeps popover open", () => {
    const onLoopConfigChange = vi.fn();
    render(<Controls {...makeProps({ onLoopConfigChange })} />);
    fireEvent.click(screen.getByLabelText("Loop mode"));
    fireEvent.click(screen.getByText("count"));
    expect(onLoopConfigChange).toHaveBeenCalledWith({ mode: "count", count: 3 });
    expect(screen.getByLabelText("Loop mode").getAttribute("aria-expanded")).toBe("true");
  });

  it("shows count input when mode is count and handles onChange", () => {
    const onLoopConfigChange = vi.fn();
    render(
      <Controls
        {...makeProps({
          loopConfig: { mode: "count" as const, count: 5 },
          onLoopConfigChange,
        })}
      />
    );
    fireEvent.click(screen.getByLabelText("Loop mode"));
    const input = screen.getByRole("spinbutton");
    expect((input as HTMLInputElement).value).toBe("5");
    fireEvent.change(input, { target: { value: "7" } });
    expect(onLoopConfigChange).toHaveBeenCalledWith({ mode: "count", count: 7 });
  });

  it("clamps count input to min 1", () => {
    const onLoopConfigChange = vi.fn();
    render(
      <Controls
        {...makeProps({
          loopConfig: { mode: "count" as const, count: 2 },
          onLoopConfigChange,
        })}
      />
    );
    fireEvent.click(screen.getByLabelText("Loop mode"));
    const input = screen.getByRole("spinbutton");
    fireEvent.change(input, { target: { value: "0" } });
    expect(onLoopConfigChange).toHaveBeenCalledWith({ mode: "count", count: 1 });
  });

  it("outside click closes popover", () => {
    render(<Controls {...makeProps()} />);
    fireEvent.click(screen.getByLabelText("Loop mode"));
    expect(screen.getByLabelText("Loop mode").getAttribute("aria-expanded")).toBe("true");
    fireEvent.mouseDown(document);
    expect(screen.getByLabelText("Loop mode").getAttribute("aria-expanded")).toBe("false");
  });

  describe("getLoopIcon display", () => {
    it("shows ∞ for loop mode", () => {
      render(<Controls {...makeProps({ loopConfig: { mode: "loop" } })} />);
      expect(screen.getByLabelText("Loop mode").textContent).toBe("∞");
    });

    it("shows 1 for once mode", () => {
      render(<Controls {...makeProps({ loopConfig: { mode: "once" } })} />);
      expect(screen.getByLabelText("Loop mode").textContent).toBe("1");
    });

    it("shows ↔ for bounce mode", () => {
      render(<Controls {...makeProps({ loopConfig: { mode: "bounce" } })} />);
      expect(screen.getByLabelText("Loop mode").textContent).toBe("↔");
    });

    it("shows count number for count mode", () => {
      render(<Controls {...makeProps({ loopConfig: { mode: "count", count: 5 } })} />);
      expect(screen.getByLabelText("Loop mode").textContent).toBe("5");
    });

    it("shows 3 for count mode without explicit count", () => {
      render(<Controls {...makeProps({ loopConfig: { mode: "count" } })} />);
      expect(screen.getByLabelText("Loop mode").textContent).toBe("3");
    });
  });
});

describe("Timeline scrubber", () => {
  it("renders with correct attributes", () => {
    render(<Controls {...makeProps({ currentFrame: 10, totalFrames: 100 })} />);
    const slider = screen.getByLabelText("Animation timeline scrubber") as HTMLInputElement;
    expect(slider.min).toBe("0");
    expect(slider.max).toBe("99");
    expect(slider.value).toBe("10");
  });

  it("calls onSeek on change", () => {
    const onSeek = vi.fn();
    render(<Controls {...makeProps({ onSeek })} />);
    fireEvent.change(screen.getByLabelText("Animation timeline scrubber"), {
      target: { value: "25" },
    });
    expect(onSeek).toHaveBeenCalledWith(25);
  });
});

describe("Time display", () => {
  it("formats time under 60s", () => {
    // currentFrame=15, frameRate=30 => 0.5s; totalFrames=60 => 2.0s
    render(<Controls {...makeProps({ currentFrame: 15, totalFrames: 60, frameRate: 30 })} />);
    const display = screen.getByTitle("Frame 15 / 60");
    expect(display.textContent).toBe("0.5s / 2.0s");
  });

  it("formats time at or above 60s", () => {
    // currentFrame=1950, frameRate=30 => 65s => 1:05.0
    // totalFrames=3600, frameRate=30 => 120s => 2:00.0
    render(<Controls {...makeProps({ currentFrame: 1950, totalFrames: 3600, frameRate: 30 })} />);
    const display = screen.getByTitle("Frame 1950 / 3600");
    expect(display.textContent).toBe("1:05.0 / 2:00.0");
  });

  it("shows frame info in title attribute", () => {
    render(<Controls {...makeProps({ currentFrame: 5, totalFrames: 60 })} />);
    expect(screen.getByTitle("Frame 5 / 60")).toBeDefined();
  });
});

describe("Keyboard shortcuts popover", () => {
  it("toggles open and closed", () => {
    render(<Controls {...makeProps()} />);
    const btn = screen.getByLabelText("Show keyboard shortcuts");
    expect(btn.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(btn);
    expect(btn.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByText("Play / Pause")).toBeDefined();
    fireEvent.click(btn);
    expect(btn.getAttribute("aria-expanded")).toBe("false");
  });

  it("shows shortcut content when open", () => {
    render(<Controls {...makeProps()} />);
    fireEvent.click(screen.getByLabelText("Show keyboard shortcuts"));
    expect(screen.getByText("Previous frame")).toBeDefined();
    expect(screen.getByText("Next frame")).toBeDefined();
    expect(screen.getByText("Undo")).toBeDefined();
    expect(screen.getByText("Redo")).toBeDefined();
  });

  it("outside click closes popover", () => {
    render(<Controls {...makeProps()} />);
    fireEvent.click(screen.getByLabelText("Show keyboard shortcuts"));
    expect(screen.getByLabelText("Show keyboard shortcuts").getAttribute("aria-expanded")).toBe("true");
    fireEvent.mouseDown(document);
    expect(screen.getByLabelText("Show keyboard shortcuts").getAttribute("aria-expanded")).toBe("false");
  });
});

describe("Duration input onBlur", () => {
  it("triggers confirmDuration on blur", () => {
    const onDurationChange = vi.fn();
    render(<Controls {...makeProps({ onDurationChange })} />);
    fireEvent.click(screen.getByLabelText("durationEdit"));
    const input = screen.getByLabelText("durationInput");
    fireEvent.change(input, { target: { value: "4.0" } });
    fireEvent.blur(input);
    expect(onDurationChange).toHaveBeenCalledWith(4.0);
  });
});
