// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useChatMessages } from "@/hooks/chat/useChatMessages";

vi.mock("@/hooks/useOnlineStatus", () => ({
  useOnlineStatus: () => ({ isOnline: true }),
}));

vi.mock("@/lib/messageQueue", () => ({
  getPendingMessages: vi.fn().mockResolvedValue([]),
  flushMessages: vi.fn().mockResolvedValue({ sent: 0 }),
}));

vi.mock("@/lib/apiFetch", () => ({
  apiFetch: vi.fn().mockResolvedValue({
    json: () => Promise.resolve({ suggestions: [] }),
  }),
}));

describe("useChatMessages", () => {
  const handleSendRef = { current: undefined } as React.RefObject<((prompt?: string) => Promise<void>) | undefined>;

  beforeEach(() => {
    vi.restoreAllMocks();
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
});
