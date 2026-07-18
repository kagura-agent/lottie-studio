/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useVersionHistory } from "../useVersionHistory";

describe("useVersionHistory", () => {
  it("initializes with null state", () => {
    const { result } = renderHook(() => useVersionHistory());
    expect(result.current.versionPreviewData).toBeNull();
    expect(result.current.previewingVersion).toBeNull();
  });

  it("handleVersionPreview sets preview data and version", () => {
    const { result } = renderHook(() => useVersionHistory());
    const data = { w: 100, h: 100 };
    act(() => result.current.handleVersionPreview(data, 3));
    expect(result.current.versionPreviewData).toBe(data);
    expect(result.current.previewingVersion).toBe(3);
  });

  it("handleExitVersionPreview clears state", () => {
    const { result } = renderHook(() => useVersionHistory());
    act(() => result.current.handleVersionPreview({ w: 100 }, 5));
    act(() => result.current.handleExitVersionPreview());
    expect(result.current.versionPreviewData).toBeNull();
    expect(result.current.previewingVersion).toBeNull();
  });
});
