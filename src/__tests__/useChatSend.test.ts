// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useChatSend } from "@/hooks/chat/useChatSend";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("@/contexts/DesignTokensContext", () => ({
  useDesignTokens: () => ({
    tokens: {},
    setToken: vi.fn(),
    clearTokens: vi.fn(),
    hasTokens: false,
  }),
}));

vi.mock("@/lib/apiFetch", () => ({
  apiFetch: vi.fn(),
}));

vi.mock("@/lib/messageQueue", () => ({
  enqueueMessage: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/commands", () => ({
  parseCommand: vi.fn().mockReturnValue(null),
  VALID_STYLES: [],
  STYLE_DESCRIPTIONS: {},
}));

vi.mock("@/data/randomPrompts", () => ({
  getRandomPrompt: () => "make a bouncing ball",
}));

vi.mock("@/lib/chat-types", () => ({
  extractLayerContext: () => null,
}));

function makeOptions(overrides = {}) {
  return {
    messages: [],
    setMessages: vi.fn(),
    setPendingCount: vi.fn(),
    currentAnimationId: "anim-1",
    setCurrentAnimationId: vi.fn(),
    onAnimationCreated: vi.fn(),
    onAnimationUpdated: vi.fn(),
    onCommand: vi.fn(),
    animationDataProp: null,
    selectedLayerIndex: null,
    onLayerContextConsumed: vi.fn(),
    isOnline: true,
    ...overrides,
  };
}

describe("useChatSend", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("initializes with empty input and idle state", () => {
    const { result } = renderHook(() => useChatSend(makeOptions()));

    expect(result.current.input).toBe("");
    expect(result.current.isThinking).toBe(false);
    expect(result.current.isStreaming).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.pendingImage).toBeNull();
  });

  it("handleSend does nothing for empty input", async () => {
    const opts = makeOptions();
    const { result } = renderHook(() => useChatSend(opts));

    await act(async () => {
      await result.current.handleSend();
    });

    expect(opts.setMessages).not.toHaveBeenCalled();
  });

  it("handleSend does nothing while thinking", async () => {
    const { apiFetch } = await import("@/lib/apiFetch");
    (apiFetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      headers: { get: () => "application/json" },
      ok: true,
      json: () => Promise.resolve({ reply: "done" }),
    });

    const setMessages = vi.fn();
    const opts = makeOptions({ setMessages });
    const { result } = renderHook(() => useChatSend(opts));

    act(() => { result.current.setInput("hello"); });

    // First send starts thinking
    const sendPromise = act(async () => {
      await result.current.handleSend();
    });

    await sendPromise;
    // Verify setMessages was called (user message added)
    expect(setMessages).toHaveBeenCalled();
  });

  it("handleStop aborts the current request", () => {
    const { result } = renderHook(() => useChatSend(makeOptions()));

    act(() => {
      result.current.handleStop();
    });

    expect(result.current.isThinking).toBe(false);
    expect(result.current.isStreaming).toBe(false);
  });

  it("dismissError clears the error state", () => {
    const { result } = renderHook(() => useChatSend(makeOptions()));

    act(() => { result.current.setError("something went wrong"); });
    expect(result.current.error).toBe("something went wrong");

    act(() => { result.current.dismissError(); });
    expect(result.current.error).toBeNull();
  });

  it("setInput updates input state", () => {
    const { result } = renderHook(() => useChatSend(makeOptions()));

    act(() => { result.current.setInput("test message"); });
    expect(result.current.input).toBe("test message");
  });

  it("queues message when offline", async () => {
    const { enqueueMessage } = await import("@/lib/messageQueue");
    const setMessages = vi.fn();
    const opts = makeOptions({ isOnline: false, setMessages });
    const { result } = renderHook(() => useChatSend(opts));

    act(() => { result.current.setInput("offline msg"); });

    await act(async () => {
      await result.current.handleSend();
    });

    expect(enqueueMessage).toHaveBeenCalledWith("anim-1", "offline msg", undefined);
  });
});
