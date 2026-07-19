/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useAnimationState } from "../useAnimationState";

const mockToast = vi.fn();
vi.mock("@/contexts/ToastContext", () => ({
  useToast: () => ({ toast: mockToast }),
}));

const mockPushState = vi.fn();
const mockUndo = vi.fn(() => null);
const mockRedo = vi.fn(() => null);
vi.mock("@/hooks/useAnimationHistory", () => ({
  useAnimationHistory: () => ({
    pushState: mockPushState,
    undo: mockUndo,
    redo: mockRedo,
    canUndo: false,
    canRedo: false,
  }),
}));

const mockSetBeforeState = vi.fn();
const mockSetAfterState = vi.fn();
vi.mock("@/hooks/useBeforeAfter", () => ({
  useBeforeAfter: () => ({
    isComparing: false,
    beforeData: null,
    afterData: null,
    comparisonMode: "side-by-side",
    setComparisonMode: vi.fn(),
    setBeforeState: mockSetBeforeState,
    setAfterState: mockSetAfterState,
    accept: vi.fn(),
    revert: vi.fn(),
  }),
}));

vi.mock("@/hooks/useAnimationSocket", () => ({
  useAnimationSocket: vi.fn(),
}));

const mockUpdatePreview = vi.fn();
const mockClearPreview = vi.fn();
vi.mock("@/hooks/chat/useProgressivePreview", () => ({
  useProgressivePreview: () => ({
    previewData: null,
    isPreviewActive: false,
    updatePreview: mockUpdatePreview,
    clearPreview: mockClearPreview,
  }),
}));

const mockSaveAnimation = vi.fn(() => Promise.resolve());
vi.mock("@/lib/offlineStorage", () => ({
  saveAnimation: (...args: unknown[]) => mockSaveAnimation(...args),
}));

const mockCaptureAndUploadThumbnail = vi.fn();
vi.mock("@/lib/captureThumbnail", () => ({
  captureAndUploadThumbnail: (...args: unknown[]) => mockCaptureAndUploadThumbnail(...args),
}));

const mockGetItem = vi.fn();
const mockSetItem = vi.fn();
Object.defineProperty(globalThis, "localStorage", {
  value: { getItem: mockGetItem, setItem: mockSetItem, removeItem: vi.fn() },
  writable: true,
});

const mockRouter = { push: vi.fn() };
const mockSetShareChat = vi.fn();

const animData = { w: 200, h: 200, layers: [{ nm: "Layer 1", ks: { o: { a: 0, k: 100 } } }] };

// Route-based fetch mock: maps URL patterns to responses
type FetchRoute = { test: (url: string, opts?: RequestInit) => boolean; handler: (url: string, opts?: RequestInit) => Promise<unknown> };
let fetchRoutes: FetchRoute[] = [];
const defaultFetch = () => Promise.resolve({ ok: false, json: () => Promise.resolve({}) });

function setupFetch() {
  global.fetch = vi.fn((url: string, opts?: RequestInit) => {
    for (const route of fetchRoutes) {
      if (route.test(url, opts)) return route.handler(url, opts);
    }
    return defaultFetch();
  }) as unknown as typeof fetch;
}

function addRoute(test: (url: string, opts?: RequestInit) => boolean, handler: (url: string, opts?: RequestInit) => Promise<unknown>) {
  fetchRoutes.push({ test, handler });
}

function renderDefault(overrides?: {
  id?: string | null;
  name?: string;
  data?: object | null;
  shareChat?: boolean;
}) {
  const o = overrides ?? {};
  return renderHook(() =>
    useAnimationState(
      "id" in o ? o.id! : "id-1",
      o.name ?? "My Anim",
      "data" in o ? o.data! : animData,
      o.shareChat ?? false,
      mockSetShareChat,
      mockRouter,
    ),
  );
}

describe("useAnimationState", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchRoutes = [];
    setupFetch();
    vi.spyOn(window.history, "replaceState").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ── Initial state ──────────────────────────────────────────
  it("initializes with provided values", () => {
    const { result } = renderDefault();
    expect(result.current.currentId).toBe("id-1");
    expect(result.current.name).toBe("My Anim");
    expect(result.current.animationData).toEqual(animData);
    expect(result.current.isNewMode).toBe(false);
    expect(result.current.currentWidth).toBe(200);
    expect(result.current.currentHeight).toBe(200);
  });

  it("isNewMode is true when id is null", () => {
    const { result } = renderDefault({ id: null });
    expect(result.current.isNewMode).toBe(true);
  });

  it("defaults to 512x512 when no dimensions", () => {
    const { result } = renderDefault({ data: {} });
    expect(result.current.currentWidth).toBe(512);
    expect(result.current.currentHeight).toBe(512);
  });

  it("reads canvasBg from localStorage when id exists", () => {
    mockGetItem.mockReturnValue("dark");
    const { result } = renderDefault();
    expect(result.current.canvasBg).toBe("dark");
    expect(mockGetItem).toHaveBeenCalledWith("lottie-bg-id-1");
  });

  it("defaults canvasBg to checkered when no localStorage", () => {
    mockGetItem.mockReturnValue(null);
    const { result } = renderDefault();
    expect(result.current.canvasBg).toBe("checkered");
  });

  it("setName updates name", () => {
    const { result } = renderDefault();
    act(() => result.current.setName("New Name"));
    expect(result.current.name).toBe("New Name");
  });

  // ── handleBgChange ─────────────────────────────────────────
  describe("handleBgChange", () => {
    it("sets canvasBg and stores in localStorage", () => {
      const { result } = renderDefault();
      act(() => result.current.handleBgChange("dark"));
      expect(result.current.canvasBg).toBe("dark");
      expect(mockSetItem).toHaveBeenCalledWith("lottie-bg-id-1", "dark");
    });

    it("does not write bg to localStorage when no currentId", () => {
      const { result } = renderDefault({ id: null });
      act(() => result.current.handleBgChange("light"));
      expect(result.current.canvasBg).toBe("light");
      expect(mockSetItem).not.toHaveBeenCalled();
    });
  });

  // ── handleArtboardChange ───────────────────────────────────
  describe("handleArtboardChange", () => {
    it("updates dimensions, localStorage, and pushes state", () => {
      const { result } = renderDefault();
      act(() => result.current.handleArtboardChange(800, 600));
      expect(result.current.currentWidth).toBe(800);
      expect(result.current.currentHeight).toBe(600);
      expect(mockSetItem).toHaveBeenCalledWith("lottie-artboard-last", JSON.stringify({ w: 800, h: 600 }));
      expect(mockSetItem).toHaveBeenCalledWith("lottie-artboard-id-1", JSON.stringify({ w: 800, h: 600 }));
      expect(mockPushState).toHaveBeenCalled();
    });

    it("does nothing when animationData is null", () => {
      const { result } = renderDefault({ data: null });
      act(() => result.current.handleArtboardChange(800, 600));
      expect(mockPushState).not.toHaveBeenCalled();
    });

    it("writes artboard-last but not per-id when no currentId", () => {
      const { result } = renderDefault({ id: null, data: { w: 100, h: 100 } });
      act(() => result.current.handleArtboardChange(300, 300));
      expect(mockSetItem).toHaveBeenCalledWith("lottie-artboard-last", JSON.stringify({ w: 300, h: 300 }));
      expect(mockSetItem).toHaveBeenCalledTimes(1);
    });
  });

  // ── handleSave ─────────────────────────────────────────────
  describe("handleSave", () => {
    it("does nothing when no currentId", async () => {
      const { result } = renderDefault({ id: null });
      await act(async () => await result.current.handleSave());
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it("saves successfully", async () => {
      addRoute(
        (_, opts) => opts?.method === "PUT",
        () => Promise.resolve({ ok: true, json: () => Promise.resolve({}) }),
      );
      const { result } = renderDefault({ data: { w: 100 } });
      await act(async () => await result.current.handleSave());
      expect(result.current.saving).toBe(false);
      expect(result.current.saveStatus).toBe("saved");
    });

    it("sets error status on failed response", async () => {
      addRoute(
        (_, opts) => opts?.method === "PUT",
        () => Promise.resolve({ ok: false }),
      );
      const { result } = renderDefault({ data: { w: 100 } });
      await act(async () => await result.current.handleSave());
      expect(result.current.saveStatus).toBe("error");
    });

    it("sets error status on invalid JSON text", async () => {
      const { result } = renderDefault();
      act(() => result.current.setJsonText("not json"));
      await act(async () => await result.current.handleSave());
      expect(result.current.saveStatus).toBe("error");
    });

    it("resets saveStatus to idle after success timeout", async () => {
      vi.useFakeTimers();
      addRoute(
        (_, opts) => opts?.method === "PUT",
        () => Promise.resolve({ ok: true }),
      );
      const { result } = renderDefault({ data: { w: 100 } });
      await act(async () => await result.current.handleSave());
      expect(result.current.saveStatus).toBe("saved");
      act(() => vi.advanceTimersByTime(2000));
      expect(result.current.saveStatus).toBe("idle");
    });

    it("resets saveStatus to idle after error timeout", async () => {
      vi.useFakeTimers();
      addRoute(
        (_, opts) => opts?.method === "PUT",
        () => Promise.resolve({ ok: false }),
      );
      const { result } = renderDefault({ data: { w: 100 } });
      await act(async () => await result.current.handleSave());
      expect(result.current.saveStatus).toBe("error");
      act(() => vi.advanceTimersByTime(3000));
      expect(result.current.saveStatus).toBe("idle");
    });
  });

  // ── handleDuplicate ────────────────────────────────────────
  describe("handleDuplicate", () => {
    it("does nothing when no currentId", async () => {
      const { result } = renderDefault({ id: null });
      await act(async () => await result.current.handleDuplicate());
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it("duplicates successfully", async () => {
      addRoute(
        (url, opts) => opts?.method === "POST" && url.includes("/duplicate"),
        () => Promise.resolve({ ok: true, json: () => Promise.resolve({ id: "new-id" }) }),
      );
      const { result } = renderDefault();
      await act(async () => await result.current.handleDuplicate());
      expect(mockRouter.push).toHaveBeenCalledWith("/editor/new-id");
      expect(mockToast).toHaveBeenCalledWith({ message: "Animation duplicated!", type: "success" });
      expect(result.current.duplicating).toBe(false);
    });

    it("shows error toast on failure", async () => {
      addRoute(
        (url, opts) => opts?.method === "POST" && url.includes("/duplicate"),
        () => Promise.reject(new Error("fail")),
      );
      const { result } = renderDefault();
      await act(async () => await result.current.handleDuplicate());
      expect(mockToast).toHaveBeenCalledWith({
        message: "Failed to duplicate animation. Please try again.",
        type: "error",
      });
      expect(result.current.duplicating).toBe(false);
    });

    it("shows error on non-ok response", async () => {
      addRoute(
        (url, opts) => opts?.method === "POST" && url.includes("/duplicate"),
        () => Promise.resolve({ ok: false }),
      );
      const { result } = renderDefault();
      await act(async () => await result.current.handleDuplicate());
      expect(mockToast).toHaveBeenCalledWith({
        message: "Failed to duplicate animation. Please try again.",
        type: "error",
      });
    });
  });

  // ── handleToggleShareChat ──────────────────────────────────
  describe("handleToggleShareChat", () => {
    it("does nothing when no currentId", async () => {
      const { result } = renderDefault({ id: null });
      await act(async () => await result.current.handleToggleShareChat());
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it("toggles share on successfully", async () => {
      addRoute(
        (_, opts) => opts?.method === "PUT",
        () => Promise.resolve({ ok: true }),
      );
      const { result } = renderDefault({ shareChat: false });
      await act(async () => await result.current.handleToggleShareChat());
      expect(mockSetShareChat).toHaveBeenCalledWith(true);
      expect(result.current.shareChatSaving).toBe(false);
    });

    it("reverts on failed response", async () => {
      addRoute(
        (_, opts) => opts?.method === "PUT",
        () => Promise.resolve({ ok: false }),
      );
      const { result } = renderDefault({ shareChat: false });
      await act(async () => await result.current.handleToggleShareChat());
      expect(mockSetShareChat).toHaveBeenCalledWith(true);
      expect(mockSetShareChat).toHaveBeenCalledWith(false);
    });

    it("reverts on fetch error", async () => {
      addRoute(
        (_, opts) => opts?.method === "PUT",
        () => Promise.reject(new Error("network")),
      );
      const { result } = renderDefault({ shareChat: false });
      await act(async () => await result.current.handleToggleShareChat());
      expect(mockSetShareChat).toHaveBeenCalledWith(false);
    });

  });

  // ── handleExternalUpdate ───────────────────────────────────
  describe("handleExternalUpdate", () => {
    it("does nothing when no currentId", async () => {
      const { result } = renderDefault({ id: null });
      await act(async () => await result.current.handleExternalUpdate());
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it("fetches and updates state on success", async () => {
      const newData = { w: 500, h: 500 };
      addRoute(
        (url) => url.includes("/animations/id-1") && !url.includes("/view"),
        () => Promise.resolve({ ok: true, json: () => Promise.resolve({ data: newData, name: "Updated" }) }),
      );
      const { result } = renderDefault();
      await act(async () => await result.current.handleExternalUpdate());
      expect(result.current.animationData).toEqual(newData);
      expect(result.current.name).toBe("Updated");
      expect(mockPushState).toHaveBeenCalledWith(newData);
    });

    it("handles fetch errors silently", async () => {
      addRoute(
        (url) => url.includes("/animations/id-1") && !url.includes("/view"),
        () => Promise.reject(new Error("net")),
      );
      const { result } = renderDefault();
      await act(async () => await result.current.handleExternalUpdate());
      expect(result.current.animationData).toEqual(animData);
    });

    it("updates state when result has data but no name", async () => {
      const newData = { w: 300, h: 300 };
      addRoute(
        (url) => url.includes("/animations/id-1") && !url.includes("/view"),
        () => Promise.resolve({ ok: true, json: () => Promise.resolve({ data: newData }) }),
      );
      const { result } = renderDefault();
      await act(async () => await result.current.handleExternalUpdate());
      expect(result.current.animationData).toEqual(newData);
      expect(result.current.name).toBe("My Anim");
    });
  });

  // ── handleAnimationCreated ─────────────────────────────────
  describe("handleAnimationCreated", () => {
    it("sets state directly when newData provided", async () => {
      const newData = { w: 400, h: 400 };
      const { result } = renderDefault();
      await act(async () => await result.current.handleAnimationCreated("new-id", newData));
      expect(result.current.currentId).toBe("new-id");
      expect(result.current.animationData).toEqual(newData);
      expect(mockPushState).toHaveBeenCalledWith(newData);
      expect(mockSetBeforeState).toHaveBeenCalledWith(animData);
      expect(mockSetAfterState).toHaveBeenCalledWith(newData);
      expect(mockSaveAnimation).toHaveBeenCalledWith("new-id", "My Anim", newData, { synced: true });
      expect(window.history.replaceState).toHaveBeenCalledWith(null, "", "/editor/new-id");
    });

    it("fetches data when newData not provided", async () => {
      const fetchedData = { w: 600, h: 600 };
      addRoute(
        (url) => url.includes("/animations/new-id"),
        () => Promise.resolve({ ok: true, json: () => Promise.resolve({ data: fetchedData, name: "Fetched" }) }),
      );
      const { result } = renderDefault();
      await act(async () => await result.current.handleAnimationCreated("new-id"));
      expect(result.current.animationData).toEqual(fetchedData);
      expect(result.current.name).toBe("Fetched");
      expect(mockSetBeforeState).toHaveBeenCalledWith(animData);
      expect(mockSetAfterState).toHaveBeenCalledWith(fetchedData);
    });

    it("handles fetch failure silently", async () => {
      addRoute(
        (url) => url.includes("/animations/new-id"),
        () => Promise.reject(new Error("fail")),
      );
      const { result } = renderDefault();
      await act(async () => await result.current.handleAnimationCreated("new-id"));
      expect(result.current.currentId).toBe("new-id");
      expect(window.history.replaceState).toHaveBeenCalled();
    });

    it("handles non-ok fetch response", async () => {
      addRoute(
        (url) => url.includes("/animations/new-id"),
        () => Promise.resolve({ ok: false }),
      );
      const { result } = renderDefault();
      await act(async () => await result.current.handleAnimationCreated("new-id"));
      expect(result.current.currentId).toBe("new-id");
    });

    it("skips before/after when no prior animationData", async () => {
      const newData = { w: 100, h: 100 };
      const { result } = renderDefault({ data: null });
      await act(async () => await result.current.handleAnimationCreated("new-id", newData));
      expect(mockSetBeforeState).not.toHaveBeenCalled();
      expect(mockSetAfterState).not.toHaveBeenCalled();
    });

    it("skips before/after when fetching and no prior animationData", async () => {
      const fetchedData = { w: 100, h: 100 };
      addRoute(
        (url) => url.includes("/animations/new-id"),
        () => Promise.resolve({ ok: true, json: () => Promise.resolve({ data: fetchedData }) }),
      );
      const { result } = renderDefault({ data: null });
      await act(async () => await result.current.handleAnimationCreated("new-id"));
      expect(mockSetBeforeState).not.toHaveBeenCalled();
    });
  });

  // ── handleAnimationUpdated ─────────────────────────────────
  describe("handleAnimationUpdated", () => {
    it("clears preview, captures thumbnail, and saves offline", async () => {
      const data = { w: 100, h: 100 };
      const { result } = renderDefault();
      await act(async () => result.current.handleAnimationUpdated("anim-1", data));
      expect(mockClearPreview).toHaveBeenCalled();
      await new Promise((r) => setTimeout(r, 10));
      expect(mockCaptureAndUploadThumbnail).toHaveBeenCalledWith("anim-1", data);
      expect(mockSaveAnimation).toHaveBeenCalledWith("anim-1", "My Anim", data, { synced: true });
    });
  });

  // ── handleProgressivePreview ────────────────────────────────
  describe("handleProgressivePreview", () => {
    it("calls updatePreview for non-null data", () => {
      const { result } = renderDefault();
      act(() => result.current.handleProgressivePreview({ w: 100 }));
      expect(mockUpdatePreview).toHaveBeenCalledWith({ w: 100 });
    });

    it("calls clearPreview for null data", () => {
      const { result } = renderDefault();
      act(() => result.current.handleProgressivePreview(null));
      expect(mockClearPreview).toHaveBeenCalled();
    });
  });

  // ── handleJsonChange ───────────────────────────────────────
  describe("handleJsonChange", () => {
    it("updates jsonText immediately", () => {
      vi.useFakeTimers();
      const { result } = renderDefault();
      act(() => result.current.handleJsonChange('{"w":100}'));
      expect(result.current.jsonText).toBe('{"w":100}');
    });

    it("parses valid JSON after debounce", () => {
      vi.useFakeTimers();
      const { result } = renderDefault();
      act(() => result.current.handleJsonChange('{"w":999}'));
      act(() => vi.advanceTimersByTime(500));
      expect(result.current.animationData).toEqual({ w: 999 });
      expect(mockPushState).toHaveBeenCalledWith({ w: 999 });
    });

    it("sets animationData to null for invalid JSON", () => {
      vi.useFakeTimers();
      const { result } = renderDefault();
      act(() => result.current.handleJsonChange("not json"));
      act(() => vi.advanceTimersByTime(500));
      expect(result.current.animationData).toBeNull();
    });

    it("debounces multiple rapid changes", () => {
      vi.useFakeTimers();
      const { result } = renderDefault();
      act(() => result.current.handleJsonChange('{"a":1}'));
      act(() => result.current.handleJsonChange('{"a":2}'));
      act(() => result.current.handleJsonChange('{"a":3}'));
      act(() => vi.advanceTimersByTime(500));
      expect(result.current.animationData).toEqual({ a: 3 });
      expect(mockPushState).toHaveBeenCalledTimes(1);
    });
  });

  // ── handleUndo / handleRedo ────────────────────────────────
  describe("handleUndo / handleRedo", () => {
    it("handleUndo applies state from undo", () => {
      const undoState = { w: 50, h: 50 };
      mockUndo.mockReturnValueOnce(undoState);
      const { result } = renderDefault();
      act(() => result.current.handleUndo());
      expect(result.current.animationData).toEqual(undoState);
      expect(result.current.jsonText).toBe(JSON.stringify(undoState, null, 2));
    });

    it("handleUndo does nothing when undo returns null", () => {
      mockUndo.mockReturnValueOnce(null);
      const { result } = renderDefault();
      const prevData = result.current.animationData;
      act(() => result.current.handleUndo());
      expect(result.current.animationData).toBe(prevData);
    });

    it("handleRedo applies state from redo", () => {
      const redoState = { w: 75, h: 75 };
      mockRedo.mockReturnValueOnce(redoState);
      const { result } = renderDefault();
      act(() => result.current.handleRedo());
      expect(result.current.animationData).toEqual(redoState);
    });

    it("handleRedo does nothing when redo returns null", () => {
      mockRedo.mockReturnValueOnce(null);
      const { result } = renderDefault();
      const prevData = result.current.animationData;
      act(() => result.current.handleRedo());
      expect(result.current.animationData).toBe(prevData);
    });
  });

  // ── handleSelectLayer ──────────────────────────────────────
  it("handleSelectLayer sets insertText and selectedLayerIndex", () => {
    vi.useFakeTimers();
    const { result } = renderDefault();
    act(() => result.current.handleSelectLayer("Layer 1", 2));
    expect(result.current.selectedLayerIndex).toBe(2);
  });

  // ── handleToggleVisibility ─────────────────────────────────
  describe("handleToggleVisibility", () => {
    it("sets hidden flag on layer", () => {
      const { result } = renderDefault();
      act(() => result.current.handleToggleVisibility(0, true));
      const data = result.current.animationData as Record<string, unknown>;
      expect((data.layers as Array<Record<string, unknown>>)[0].hd).toBe(true);
      expect(mockPushState).toHaveBeenCalled();
    });

    it("does nothing when animationData is null", () => {
      const { result } = renderDefault({ data: null });
      act(() => result.current.handleToggleVisibility(0, true));
      expect(mockPushState).not.toHaveBeenCalled();
    });

    it("does nothing for out-of-bounds layer", () => {
      const { result } = renderDefault();
      act(() => result.current.handleToggleVisibility(99, true));
      expect(mockPushState).not.toHaveBeenCalled();
    });
  });

  // ── handleChangeOpacity ────────────────────────────────────
  describe("handleChangeOpacity", () => {
    it("sets static opacity", () => {
      const { result } = renderDefault();
      act(() => result.current.handleChangeOpacity(0, 50));
      const layers = (result.current.animationData as Record<string, unknown>).layers as Array<Record<string, unknown>>;
      const o = (layers[0].ks as Record<string, unknown>).o as Record<string, unknown>;
      expect(o.k).toBe(50);
      expect(o.a).toBe(0);
      expect(mockPushState).toHaveBeenCalled();
    });

    it("sets animated keyframe opacity", () => {
      const kfData = {
        w: 200, h: 200,
        layers: [{ nm: "L1", ks: { o: { a: 1, k: [{ s: [100], e: [100] }, { s: [100], e: [100] }] } } }],
      };
      const { result } = renderDefault({ data: kfData });
      act(() => result.current.handleChangeOpacity(0, 75));
      const layers = (result.current.animationData as Record<string, unknown>).layers as Array<Record<string, unknown>>;
      const kArr = ((layers[0].ks as Record<string, unknown>).o as Record<string, unknown>).k as Array<Record<string, unknown>>;
      expect(kArr[0].s).toEqual([75]);
      expect(kArr[0].e).toEqual([75]);
    });

    it("does nothing when animationData is null", () => {
      const { result } = renderDefault({ data: null });
      act(() => result.current.handleChangeOpacity(0, 50));
      expect(mockPushState).not.toHaveBeenCalled();
    });

    it("initializes ks and o if missing", () => {
      const noKsData = { w: 200, h: 200, layers: [{ nm: "bare" }] };
      const { result } = renderDefault({ data: noKsData });
      act(() => result.current.handleChangeOpacity(0, 80));
      const layers = (result.current.animationData as Record<string, unknown>).layers as Array<Record<string, unknown>>;
      const o = (layers[0].ks as Record<string, unknown>).o as Record<string, unknown>;
      expect(o.k).toBe(80);
    });
  });

  // ── handlePreviewOpacity ───────────────────────────────────
  describe("handlePreviewOpacity", () => {
    it("sets opacity without pushing state", () => {
      const { result } = renderDefault();
      act(() => result.current.handlePreviewOpacity(0, 30));
      const layers = (result.current.animationData as Record<string, unknown>).layers as Array<Record<string, unknown>>;
      const o = (layers[0].ks as Record<string, unknown>).o as Record<string, unknown>;
      expect(o.k).toBe(30);
      expect(mockPushState).not.toHaveBeenCalled();
    });

    it("does nothing when animationData is null", () => {
      const { result } = renderDefault({ data: null });
      act(() => result.current.handlePreviewOpacity(0, 30));
    });

    it("handles animated keyframes", () => {
      const kfData = {
        w: 200, h: 200,
        layers: [{ nm: "L1", ks: { o: { a: 1, k: [{ s: [100], e: [100] }] } } }],
      };
      const { result } = renderDefault({ data: kfData });
      act(() => result.current.handlePreviewOpacity(0, 40));
      const layers = (result.current.animationData as Record<string, unknown>).layers as Array<Record<string, unknown>>;
      const kArr = ((layers[0].ks as Record<string, unknown>).o as Record<string, unknown>).k as Array<Record<string, unknown>>;
      expect(kArr[0].s).toEqual([40]);
    });
  });

  // ── handleReorderLayers ────────────────────────────────────
  describe("handleReorderLayers", () => {
    it("reorders layers", () => {
      const multiData = { w: 200, h: 200, layers: [{ nm: "A" }, { nm: "B" }, { nm: "C" }] };
      const { result } = renderDefault({ data: multiData });
      act(() => result.current.handleReorderLayers(0, 2));
      const layers = (result.current.animationData as Record<string, unknown>).layers as Array<Record<string, unknown>>;
      expect(layers[0].nm).toBe("B");
      expect(layers[2].nm).toBe("A");
      expect(mockPushState).toHaveBeenCalled();
    });

    it("does nothing when animationData is null", () => {
      const { result } = renderDefault({ data: null });
      act(() => result.current.handleReorderLayers(0, 1));
      expect(mockPushState).not.toHaveBeenCalled();
    });

    it("does nothing for out-of-bounds indices", () => {
      const { result } = renderDefault();
      act(() => result.current.handleReorderLayers(0, 99));
      expect(mockPushState).not.toHaveBeenCalled();
    });
  });

  // ── Initial effects ────────────────────────────────────────
  describe("initial effects", () => {
    it("fetches share_chat on mount when currentId exists", async () => {
      addRoute(
        (url) => url.includes("/animations/id-1") && !url.includes("/view") && !url.includes("/duplicate"),
        () => Promise.resolve({ ok: true, json: () => Promise.resolve({ share_chat: true }) }),
      );
      renderDefault();
      await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
      expect(mockSetShareChat).toHaveBeenCalledWith(true);
    });

    it("posts view when shareChat is true", async () => {
      addRoute(
        (url) => url.includes("/view"),
        () => Promise.resolve({ ok: true }),
      );
      renderDefault({ shareChat: true });
      await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
      const viewCalls = (global.fetch as ReturnType<typeof vi.fn>).mock.calls.filter(
        (c: unknown[]) => typeof c[0] === "string" && (c[0] as string).includes("/view"),
      );
      expect(viewCalls.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ── debounce cleanup ───────────────────────────────────────
  it("clears debounce timer on unmount", () => {
    vi.useFakeTimers();
    const { result, unmount } = renderDefault();
    act(() => result.current.handleJsonChange('{"x":1}'));
    unmount();
    act(() => vi.advanceTimersByTime(1000));
  });
});
