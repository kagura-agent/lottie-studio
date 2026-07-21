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

describe("Duration control", () => {
  it("renders current duration as clickable text", () => {
    render(<Controls {...makeProps()} />);
    const btn = screen.getByLabelText("durationEdit");
    expect(btn).toBeDefined();
    expect(btn.textContent).toBe("2.0s");
  });

  it("switches to input on click", () => {
    render(<Controls {...makeProps()} />);
    fireEvent.click(screen.getByLabelText("durationEdit"));
    const input = screen.getByLabelText("durationInput");
    expect(input).toBeDefined();
    expect((input as HTMLInputElement).value).toBe("2.0");
  });

  it("confirms on Enter and calls onDurationChange", () => {
    const onDurationChange = vi.fn();
    render(<Controls {...makeProps({ onDurationChange })} />);
    fireEvent.click(screen.getByLabelText("durationEdit"));
    const input = screen.getByLabelText("durationInput");
    fireEvent.change(input, { target: { value: "3.5" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onDurationChange).toHaveBeenCalledWith(3.5);
  });

  it("cancels on Escape without calling onDurationChange", () => {
    const onDurationChange = vi.fn();
    render(<Controls {...makeProps({ onDurationChange })} />);
    fireEvent.click(screen.getByLabelText("durationEdit"));
    const input = screen.getByLabelText("durationInput");
    fireEvent.change(input, { target: { value: "5.0" } });
    fireEvent.keyDown(input, { key: "Escape" });
    expect(onDurationChange).not.toHaveBeenCalled();
  });

  it("+ button increases duration by 0.5s", () => {
    const onDurationChange = vi.fn();
    render(<Controls {...makeProps({ onDurationChange })} />);
    fireEvent.click(screen.getByLabelText("durationIncrease"));
    expect(onDurationChange).toHaveBeenCalledWith(2.5);
  });

  it("- button decreases duration by 0.5s", () => {
    const onDurationChange = vi.fn();
    render(<Controls {...makeProps({ onDurationChange })} />);
    fireEvent.click(screen.getByLabelText("durationDecrease"));
    expect(onDurationChange).toHaveBeenCalledWith(1.5);
  });

  it("clamps to min 0.5s", () => {
    const onDurationChange = vi.fn();
    render(<Controls {...makeProps({ onDurationChange, totalFrames: 30 })} />);
    // totalFrames=30, frameRate=30 => 1.0s; decrease by 0.5 => 0.5s
    fireEvent.click(screen.getByLabelText("durationDecrease"));
    expect(onDurationChange).toHaveBeenCalledWith(0.5);
  });

  it("clamps to max 30s", () => {
    const onDurationChange = vi.fn();
    render(<Controls {...makeProps({ onDurationChange, totalFrames: 900 })} />);
    // totalFrames=900, frameRate=30 => 30s; + button should be disabled
    const btn = screen.getByLabelText("durationIncrease");
    expect(btn).toHaveProperty("disabled", true);
  });

  it("clamps typed input to bounds", () => {
    const onDurationChange = vi.fn();
    render(<Controls {...makeProps({ onDurationChange })} />);
    fireEvent.click(screen.getByLabelText("durationEdit"));
    const input = screen.getByLabelText("durationInput");
    fireEvent.change(input, { target: { value: "50" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onDurationChange).toHaveBeenCalledWith(30);
  });

  it("does not render duration control without onDurationChange prop", () => {
    render(<Controls {...makeProps({ onDurationChange: undefined })} />);
    expect(screen.queryByLabelText("durationEdit")).toBeNull();
  });
});
