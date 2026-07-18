/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useExportState } from "../useExportState";

vi.mock("@/contexts/ToastContext", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock("@/lib/rescaleForExport", () => ({
  rescaleForExport: (data: object) => ({ animationData: data }),
}));

vi.mock("@/lib/exportPresets", () => ({
  getPresetFilename: (name: string) => `${name}.json`,
}));

describe("useExportState", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("initializes with no exports in progress", () => {
    const { result } = renderHook(() => useExportState(null, "test"));
    expect(result.current.gifExporting).toBe(false);
    expect(result.current.gifProgress).toBe(0);
    expect(result.current.apngExporting).toBe(false);
    expect(result.current.videoExporting).toBe(false);
    expect(result.current.mp4Exporting).toBe(false);
    expect(result.current.presetExporting).toBe(false);
    expect(result.current.presetExportingId).toBeNull();
  });

  it("handleExport does nothing when animationData is null", () => {
    const { result } = renderHook(() => useExportState(null, "test"));
    const createSpy = vi.spyOn(URL, "createObjectURL");
    act(() => result.current.handleExport());
    expect(createSpy).not.toHaveBeenCalled();
    createSpy.mockRestore();
  });

  it("handleExport triggers download for valid data", () => {
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:test");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});

    const { result } = renderHook(() => useExportState({ w: 100, h: 100 }, "my-anim"));
    act(() => result.current.handleExport());
    expect(URL.createObjectURL).toHaveBeenCalled();

    vi.restoreAllMocks();
  });

  it("handleExportGif does nothing when animationData is null", async () => {
    const { result } = renderHook(() => useExportState(null, "test"));
    const evt = { preventDefault: vi.fn() } as unknown as React.MouseEvent;
    await act(async () => {
      await result.current.handleExportGif(evt);
    });
    expect(result.current.gifExporting).toBe(false);
  });
});
