/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useAnimationState } from "../useAnimationState";

vi.mock("@/contexts/ToastContext", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock("@/hooks/useAnimationHistory", () => ({
  useAnimationHistory: () => ({
    pushState: vi.fn(),
    undo: vi.fn(() => null),
    redo: vi.fn(() => null),
    canUndo: false,
    canRedo: false,
  }),
}));

vi.mock("@/hooks/useBeforeAfter", () => ({
  useBeforeAfter: () => ({
    isComparing: false,
    beforeData: null,
    afterData: null,
    comparisonMode: "side-by-side",
    setComparisonMode: vi.fn(),
    setBeforeState: vi.fn(),
    setAfterState: vi.fn(),
    accept: vi.fn(),
    revert: vi.fn(),
  }),
}));

vi.mock("@/hooks/useAnimationSocket", () => ({
  useAnimationSocket: vi.fn(),
}));

vi.mock("@/hooks/chat/useProgressivePreview", () => ({
  useProgressivePreview: () => ({
    previewData: null,
    isPreviewActive: false,
    updatePreview: vi.fn(),
    clearPreview: vi.fn(),
  }),
}));

vi.mock("@/lib/offlineStorage", () => ({
  saveAnimation: vi.fn(() => Promise.resolve()),
}));

const mockGetItem = vi.fn();
const mockSetItem = vi.fn();
Object.defineProperty(globalThis, "localStorage", {
  value: { getItem: mockGetItem, setItem: mockSetItem, removeItem: vi.fn() },
  writable: true,
});

const mockRouter = { push: vi.fn() };
const mockSetShareChat = vi.fn();

describe("useAnimationState", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn(() => Promise.resolve({ ok: false, json: () => Promise.resolve({}) })) as unknown as typeof fetch;
  });

  it("initializes with provided values", () => {
    const data = { w: 200, h: 200 };
    const { result } = renderHook(() =>
      useAnimationState("id-1", "My Anim", data, false, mockSetShareChat, mockRouter)
    );
    expect(result.current.currentId).toBe("id-1");
    expect(result.current.name).toBe("My Anim");
    expect(result.current.animationData).toEqual(data);
    expect(result.current.isNewMode).toBe(false);
    expect(result.current.currentWidth).toBe(200);
    expect(result.current.currentHeight).toBe(200);
  });

  it("isNewMode is true when id is null", () => {
    const { result } = renderHook(() =>
      useAnimationState(null, "New", null, false, mockSetShareChat, mockRouter)
    );
    expect(result.current.isNewMode).toBe(true);
  });

  it("setName updates name", () => {
    const { result } = renderHook(() =>
      useAnimationState(null, "Old", null, false, mockSetShareChat, mockRouter)
    );
    act(() => result.current.setName("New Name"));
    expect(result.current.name).toBe("New Name");
  });

  it("handleJsonChange updates jsonText", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() =>
      useAnimationState(null, "Test", null, false, mockSetShareChat, mockRouter)
    );
    act(() => result.current.handleJsonChange('{"w":100}'));
    expect(result.current.jsonText).toBe('{"w":100}');
    vi.useRealTimers();
  });

  it("handleSave does nothing when no currentId", async () => {
    const { result } = renderHook(() =>
      useAnimationState(null, "Test", null, false, mockSetShareChat, mockRouter)
    );
    await act(async () => await result.current.handleSave());
    expect(result.current.saving).toBe(false);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("defaults to 512x512 when no dimensions in data", () => {
    const { result } = renderHook(() =>
      useAnimationState(null, "Test", {}, false, mockSetShareChat, mockRouter)
    );
    expect(result.current.currentWidth).toBe(512);
    expect(result.current.currentHeight).toBe(512);
  });

  it("handleSelectLayer sets insert text and layer index", () => {
    const { result } = renderHook(() =>
      useAnimationState(null, "Test", null, false, mockSetShareChat, mockRouter)
    );
    vi.useFakeTimers();
    act(() => result.current.handleSelectLayer("Layer 1", 2));
    expect(result.current.selectedLayerIndex).toBe(2);
    vi.useRealTimers();
  });
});
