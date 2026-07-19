// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useChatMessages } from "@/hooks/chat/useChatMessages";

const mockIsOnline = { isOnline: true };
vi.mock("@/hooks/useOnlineStatus", () => ({
  useOnlineStatus: () => mockIsOnline,
}));

const mockGetPendingMessages = vi.fn().mockResolvedValue([]);
const mockFlushMessages = vi.fn().mockResolvedValue({ sent: 0 });
vi.mock("@/lib/messageQueue", () => ({
  getPendingMessages: (...args: unknown[]) => mockGetPendingMessages(...args),
  flushMessages: (...args: unknown[]) => mockFlushMessages(...args),
}));

const mockApiFetch = vi.fn().mockResolvedValue({
  json: () => Promise.resolve({ suggestions: [] }),
});
vi.mock("@/lib/apiFetch", () => ({
  apiFetch: (...args: unknown[]) => mockApiFetch(...args),
}));

describe("useChatMessages", () => {
  const handleSendRef = { current: undefined } as React.RefObject<((prompt?: string) => Promise<void>) | undefined>;

  beforeEach(() => {
    vi.restoreAllMocks();
    mockIsOnline.isOnline = true;
    mockGetPendingMessages.mockResolvedValue([]);
    mockFlushMessages.mockResolvedValue({ sent: 0 });
    mockApiFetch.mockResolvedValue({
      json: () => Promise.resolve({ suggestions: [] }),
    });
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ messages: [] }),
    });
  });



  it("initializes with empty messages", () => {
    const { result } = renderHook(() =>
      useChatMessages(undefined, null, null, handleSendRef)
    );
    expect(result.current.messages).toEqual([]);
    expect(result.current.pendingCount).toBe(0);
    expect(result.current.isOnline).toBe(true);
  });

  it("loads history when animationId is provided", async () => {
    const mockMessages = [
      { id: "1", role: "user", content: "hello" },
      { id: "2", role: "assistant", content: "hi there" },
    ];
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ messages: mockMessages }),
    });

    const { result } = renderHook(() =>
      useChatMessages("anim-1", null, null, handleSendRef)
    );

    await waitFor(() => {
      expect(result.current.messages).toHaveLength(2);
    });
    expect(result.current.messages[0].content).toBe("hello");
  });

  it("dismissWarning adds id to dismissed set", () => {
    const { result } = renderHook(() =>
      useChatMessages(undefined, null, null, handleSendRef)
    );

    act(() => {
      result.current.dismissWarning("msg-1");
    });

    expect(result.current.dismissedWarnings.has("msg-1")).toBe(true);
  });

  it("handleClearChat clears messages after confirmation", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ messages: [{ id: "1", role: "user", content: "hi" }] }),
    });

    const { result } = renderHook(() =>
      useChatMessages("anim-1", null, null, handleSendRef)
    );

    await waitFor(() => expect(result.current.messages).toHaveLength(1));

    window.confirm = vi.fn().mockReturnValue(true);
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });

    await act(async () => {
      await result.current.handleClearChat("anim-1");
    });

    expect(result.current.messages).toEqual([]);
  });

  it("handleClearChat does nothing without confirmation", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ messages: [{ id: "1", role: "user", content: "hi" }] }),
    });

    const { result } = renderHook(() =>
      useChatMessages("anim-1", null, null, handleSendRef)
    );

    await waitFor(() => expect(result.current.messages).toHaveLength(1));

    window.confirm = vi.fn().mockReturnValue(false);

    await act(async () => {
      await result.current.handleClearChat("anim-1");
    });

    expect(result.current.messages).toHaveLength(1);
  });

  it("lastAssistantMsgId returns the last assistant message id", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        messages: [
          { id: "1", role: "user", content: "hi" },
          { id: "2", role: "assistant", content: "hello" },
          { id: "3", role: "user", content: "bye" },
        ],
      }),
    });

    const { result } = renderHook(() =>
      useChatMessages("anim-1", null, null, handleSendRef)
    );

    await waitFor(() => expect(result.current.messages).toHaveLength(3));
    expect(result.current.lastAssistantMsgId).toBe("2");
  });

  it("scrollToBottom calls scrollIntoView on ref", () => {
    const { result } = renderHook(() =>
      useChatMessages(undefined, null, null, handleSendRef)
    );
    // Should not throw when ref is null
    act(() => {
      result.current.scrollToBottom();
    });
  });

  it("loads history with lottieJson, previousLottieJson, and imageUrl fields", async () => {
    const mockMessages = [
      { id: "1", role: "assistant", content: "here", lottieJson: { v: "5" }, previousLottieJson: { v: "4" }, imageUrl: "http://img.png" },
    ];
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ messages: mockMessages }),
    });

    const { result } = renderHook(() =>
      useChatMessages("anim-map", null, null, handleSendRef)
    );

    await waitFor(() => expect(result.current.messages).toHaveLength(1));
    expect(result.current.messages[0].lottieJson).toEqual({ v: "5" });
    expect(result.current.messages[0].previousLottieJson).toEqual({ v: "4" });
    expect(result.current.messages[0].imageUrl).toBe("http://img.png");
  });

  it("returns early when fetch response is not ok", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({}),
    });

    const { result } = renderHook(() =>
      useChatMessages("anim-fail", null, null, handleSendRef)
    );

    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    expect(result.current.messages).toEqual([]);
  });

  it("triggers auto-describe when messages are empty but templateSource exists", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ messages: [], templateSource: "some-template" }),
    });
    const mockSend = vi.fn().mockResolvedValue(undefined);
    const sendRef = { current: mockSend } as React.RefObject<(prompt?: string) => Promise<void>>;

    renderHook(() =>
      useChatMessages("anim-auto", null, null, sendRef)
    );

    await waitFor(() => expect(mockSend).toHaveBeenCalledWith("Describe this animation and suggest ways I can modify it"));
  });

  it("does not set messages when cancelled (unmount before fetch resolves)", async () => {
    let resolvePromise: (value: unknown) => void;
    const pendingPromise = new Promise((resolve) => { resolvePromise = resolve; });
    global.fetch = vi.fn().mockReturnValue(pendingPromise);

    const { unmount } = renderHook(() =>
      useChatMessages("anim-cancel", null, null, handleSendRef)
    );

    unmount();
    resolvePromise!({
      ok: true,
      json: () => Promise.resolve({ messages: [{ id: "1", role: "user", content: "hi" }] }),
    });
    await new Promise((r) => setTimeout(r, 10));
  });

  it("getPendingMessages sets pendingCount when non-empty", async () => {
    mockGetPendingMessages.mockResolvedValue([{ id: "1", content: "queued" }]);

    const { result } = renderHook(() =>
      useChatMessages(undefined, null, null, handleSendRef)
    );

    await waitFor(() => expect(result.current.pendingCount).toBe(1));
  });

  it("flushMessages resets pendingCount when sent > 0", async () => {
    mockGetPendingMessages.mockResolvedValue([{ id: "1", content: "queued" }]);
    mockFlushMessages.mockImplementation(async (sender: (msg: { content: string }) => Promise<boolean>) => {
      await sender({ content: "queued" });
      return { sent: 1 };
    });
    const mockSend = vi.fn().mockResolvedValue(undefined);
    const sendRef = { current: mockSend } as React.RefObject<(prompt?: string) => Promise<void>>;

    const { result } = renderHook(() =>
      useChatMessages(undefined, null, null, sendRef)
    );

    await waitFor(() => expect(result.current.pendingCount).toBe(0));
    expect(mockFlushMessages).toHaveBeenCalled();
  });

  it("dismissQualityHints adds id to dismissed set", () => {
    const { result } = renderHook(() =>
      useChatMessages(undefined, null, null, handleSendRef)
    );

    act(() => {
      result.current.dismissQualityHints("hint-1");
    });

    expect(result.current.dismissedQualityHints.has("hint-1")).toBe(true);
  });

  it("handleClearChat returns early with undefined animationId", async () => {
    const { result } = renderHook(() =>
      useChatMessages(undefined, null, null, handleSendRef)
    );

    await act(async () => {
      await result.current.handleClearChat(undefined);
    });
    // Should not call confirm or fetch
    expect(global.fetch).not.toHaveBeenCalledWith(expect.stringContaining("/api/chat/"), expect.objectContaining({ method: "DELETE" }));
  });

  it("handleClearChat returns early when messages are empty", async () => {
    const { result } = renderHook(() =>
      useChatMessages("anim-1", null, null, handleSendRef)
    );

    await waitFor(() => expect(global.fetch).toHaveBeenCalled());

    window.confirm = vi.fn();
    await act(async () => {
      await result.current.handleClearChat("anim-1");
    });
    expect(window.confirm).not.toHaveBeenCalled();
  });

  it("handleClearChat throws when DELETE response is not ok", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ messages: [{ id: "1", role: "user", content: "hi" }] }),
    });

    const { result } = renderHook(() =>
      useChatMessages("anim-err", null, null, handleSendRef)
    );

    await waitFor(() => expect(result.current.messages).toHaveLength(1));

    window.confirm = vi.fn().mockReturnValue(true);
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: "server error" }),
    });

    await expect(
      act(async () => {
        await result.current.handleClearChat("anim-err");
      })
    ).rejects.toThrow("Failed to clear chat history");
  });

  it("handleClearChat throws when DELETE json parsing fails", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ messages: [{ id: "1", role: "user", content: "hi" }] }),
    });

    const { result } = renderHook(() =>
      useChatMessages("anim-err2", null, null, handleSendRef)
    );

    await waitFor(() => expect(result.current.messages).toHaveLength(1));

    window.confirm = vi.fn().mockReturnValue(true);
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: () => Promise.reject(new Error("parse error")),
    });

    await expect(
      act(async () => {
        await result.current.handleClearChat("anim-err2");
      })
    ).rejects.toThrow("Failed to clear chat history");
  });

  it("lastAssistantMsgId returns null when no assistant messages", () => {
    const { result } = renderHook(() =>
      useChatMessages(undefined, null, null, handleSendRef)
    );

    expect(result.current.lastAssistantMsgId).toBeNull();
  });

  it("lastSuggestionMsgId returns id of last assistant message with suggestions", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        messages: [
          { id: "1", role: "assistant", content: "a" },
          { id: "2", role: "assistant", content: "b" },
        ],
      }),
    });

    const { result } = renderHook(() =>
      useChatMessages("anim-sug", null, null, handleSendRef)
    );

    await waitFor(() => expect(result.current.messages).toHaveLength(2));

    // Messages loaded from API don't have suggestions, so should be null
    expect(result.current.lastSuggestionMsgId).toBeNull();

    // Add a message with suggestions
    act(() => {
      result.current.setMessages((prev) => [
        ...prev,
        { id: "3", role: "assistant" as const, content: "c", suggestions: [{ label: "x", prompt: "y" }] },
      ]);
    });

    expect(result.current.lastSuggestionMsgId).toBe("3");
  });

  it("fetches dynamic suggestions after debounce when animationData and messages exist", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        messages: [{ id: "1", role: "user", content: "hi" }],
      }),
    });

    mockApiFetch.mockResolvedValue({
      json: () => Promise.resolve({ suggestions: [{ label: "test", prompt: "do it" }] }),
    });

    const animData = { layers: [{ nm: "layer0" }] };
    const animData2 = { layers: [{ nm: "layer0" }, { nm: "layer1" }] };

    const { result, rerender } = renderHook(
      ({ aData, layer }) => useChatMessages("anim-dyn", aData, layer, handleSendRef),
      { initialProps: { aData: animData as object | null, layer: 0 as number | null } }
    );

    await waitFor(() => expect(result.current.messages).toHaveLength(1));

    // Change animationData to re-trigger the suggestions effect now that messages exist
    rerender({ aData: animData2, layer: 0 });

    await waitFor(() => expect(result.current.dynamicSuggestions).toEqual([{ label: "test", prompt: "do it" }]), { timeout: 2000 });
    expect(mockApiFetch).toHaveBeenCalledWith("/api/suggestions", expect.objectContaining({ method: "POST" }));
  });

  it("clears dynamicSuggestions when suggestionsKey becomes undefined", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        messages: [{ id: "1", role: "user", content: "hi" }],
      }),
    });

    mockApiFetch.mockResolvedValue({
      json: () => Promise.resolve({ suggestions: [{ label: "s", prompt: "p" }] }),
    });

    const animData = { layers: [] };
    const animData2 = { layers: [{ nm: "x" }] };

    const { result, rerender } = renderHook(
      ({ aData }) => useChatMessages("anim-clear", aData, null, handleSendRef),
      { initialProps: { aData: animData as object | null } }
    );

    await waitFor(() => expect(result.current.messages).toHaveLength(1));

    // Trigger suggestions effect with a different animData
    rerender({ aData: animData2 });

    await waitFor(() => expect(result.current.dynamicSuggestions).not.toBeNull(), { timeout: 2000 });

    // Clear messages to make suggestionsKey undefined, then change animData
    act(() => { result.current.setMessages([]); });
    rerender({ aData: null });

    await waitFor(() => expect(result.current.dynamicSuggestions).toBeNull());
  });

  it("does not fetch suggestions when no animationData or no messages", async () => {
    mockApiFetch.mockClear();

    renderHook(() =>
      useChatMessages(undefined, null, null, handleSendRef)
    );

    await new Promise((r) => setTimeout(r, 1000));
    expect(mockApiFetch).not.toHaveBeenCalled();
  });
});
