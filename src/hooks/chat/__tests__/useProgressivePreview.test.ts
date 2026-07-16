import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useProgressivePreview } from "../useProgressivePreview";
import type { PartialLottie } from "@/lib/partial-lottie";

const makeLottie = (overrides?: Partial<PartialLottie>): PartialLottie => ({
  v: "5.7.0",
  w: 512,
  h: 512,
  fr: 30,
  ip: 0,
  op: 60,
  layers: [],
  ...overrides,
});

describe("useProgressivePreview", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts with no preview", () => {
    const { result } = renderHook(() => useProgressivePreview());
    expect(result.current.previewData).toBeNull();
    expect(result.current.isPreviewActive).toBe(false);
  });

  it("updates preview immediately on first call", () => {
    const { result } = renderHook(() => useProgressivePreview());
    const data = makeLottie();
    act(() => {
      result.current.updatePreview(data);
    });
    expect(result.current.previewData).toBe(data);
    expect(result.current.isPreviewActive).toBe(true);
  });

  it("debounces rapid updates", () => {
    const { result } = renderHook(() => useProgressivePreview());
    const data1 = makeLottie({ w: 100 });
    const data2 = makeLottie({ w: 200 });

    act(() => {
      result.current.updatePreview(data1);
    });
    expect(result.current.previewData).toBe(data1);

    // Second update within 500ms should be debounced
    act(() => {
      vi.advanceTimersByTime(100);
      result.current.updatePreview(data2);
    });
    expect(result.current.previewData).toBe(data1);

    // After debounce period it should update
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(result.current.previewData).toBe(data2);
  });

  it("clears preview", () => {
    const { result } = renderHook(() => useProgressivePreview());
    act(() => {
      result.current.updatePreview(makeLottie());
    });
    expect(result.current.isPreviewActive).toBe(true);

    act(() => {
      result.current.clearPreview();
    });
    expect(result.current.previewData).toBeNull();
    expect(result.current.isPreviewActive).toBe(false);
  });
});
