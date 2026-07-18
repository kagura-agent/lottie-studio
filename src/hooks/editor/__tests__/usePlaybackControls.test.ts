/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { usePlaybackControls } from "../usePlaybackControls";

const mockGetItem = vi.fn();
const mockSetItem = vi.fn();
Object.defineProperty(globalThis, "localStorage", {
  value: { getItem: mockGetItem, setItem: mockSetItem, removeItem: vi.fn() },
  writable: true,
});

describe("usePlaybackControls", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("initializes with defaults", () => {
    const { result } = renderHook(() => usePlaybackControls(null));
    expect(result.current.isPlaying).toBe(true);
    expect(result.current.speed).toBe(1);
    expect(result.current.loopConfig).toEqual({ mode: "loop" });
    expect(result.current.currentFrame).toBe(0);
    expect(result.current.totalFrames).toBe(0);
    expect(result.current.seekFrame).toBeUndefined();
  });

  it("loads loop config from localStorage", () => {
    mockGetItem.mockReturnValue(JSON.stringify({ mode: "once" }));
    const { result } = renderHook(() => usePlaybackControls("test-id"));
    expect(result.current.loopConfig).toEqual({ mode: "once" });
  });

  it("handleFrameChange updates current and total", () => {
    const { result } = renderHook(() => usePlaybackControls(null));
    act(() => result.current.handleFrameChange(10, 60));
    expect(result.current.currentFrame).toBe(10);
    expect(result.current.totalFrames).toBe(60);
  });

  it("handleSeek sets frame and pauses", () => {
    const { result } = renderHook(() => usePlaybackControls(null));
    act(() => result.current.handleSeek(25));
    expect(result.current.seekFrame).toBe(25);
    expect(result.current.isPlaying).toBe(false);
  });

  it("handleRestart resets to frame 0 and plays", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => usePlaybackControls(null));
    act(() => result.current.setIsPlaying(false));
    act(() => result.current.handleRestart());
    expect(result.current.seekFrame).toBe(0);
    expect(result.current.isPlaying).toBe(true);
    act(() => vi.advanceTimersByTime(100));
    expect(result.current.seekFrame).toBeUndefined();
    vi.useRealTimers();
  });

  it("setSpeed changes speed", () => {
    const { result } = renderHook(() => usePlaybackControls(null));
    act(() => result.current.setSpeed(2));
    expect(result.current.speed).toBe(2);
  });

  it("setLoopConfig changes config", () => {
    const { result } = renderHook(() => usePlaybackControls(null));
    act(() => result.current.setLoopConfig({ mode: "bounce" }));
    expect(result.current.loopConfig).toEqual({ mode: "bounce" });
  });
});
