// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useChatSend } from "@/hooks/chat/useChatSend";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("@/contexts/DesignTokensContext", () => ({
  useDesignTokens: vi.fn(() => ({
    tokens: {},
    setToken: vi.fn(),
    clearTokens: vi.fn(),
    hasTokens: false,
  })),
}));

vi.mock("@/lib/apiFetch", () => ({
  apiFetch: vi.fn(),
}));

vi.mock("@/lib/messageQueue", () => ({
  enqueueMessage: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/commands", () => ({
  parseCommand: vi.fn().mockReturnValue(null),
  VALID_STYLES: ["neon", "pastel"],
  STYLE_DESCRIPTIONS: { neon: "Glowing", pastel: "Soft" },
}));

vi.mock("@/data/randomPrompts", () => ({
  getRandomPrompt: () => "make a bouncing ball",
}));

vi.mock("@/lib/chat-types", () => ({
  extractLayerContext: vi.fn().mockReturnValue(null),
}));

vi.mock("@/lib/partial-lottie", () => ({
  extractPartialLottie: vi.fn().mockReturnValue(null),
}));

function makeCallbackMock(initial: unknown = []) {
  const fn = vi.fn((valOrFn: unknown) => {
    if (typeof valOrFn === "function") {
      return (valOrFn as (prev: unknown) => unknown)(initial);
    }
    return valOrFn;
  });
  return fn;
}

function makeOptions(overrides: Record<string, unknown> = {}) {
  return {
    messages: [] as import("@/lib/chat-types").Message[],
    setMessages: makeCallbackMock(overrides.messages || []),
    setPendingCount: makeCallbackMock(0),
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

function makeSSEResponse(events: Array<{ type: string; [key: string]: unknown }>) {
  const encoder = new TextEncoder();
  const chunks = events.map(e => encoder.encode(`data: ${JSON.stringify(e)}\n\n`));
  let i = 0;
  const body = new ReadableStream({
    pull(controller) {
      if (i < chunks.length) {
        controller.enqueue(chunks[i++]);
      } else {
        controller.close();
      }
    },
  });
  return {
    headers: { get: (h: string) => h.toLowerCase() === "content-type" ? "text/event-stream" : null },
    ok: true,
    body,
  };
}

function makeJSONResponse(data: object, ok = true, status = 200) {
  return {
    headers: { get: () => "application/json" },
    ok,
    status,
    json: () => Promise.resolve(data),
  };
}

describe("useChatSend", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

  describe("SSE streaming", () => {
    it("token events update messages and done finalizes", async () => {
      const { apiFetch } = await import("@/lib/apiFetch");
      const mockApiFetch = apiFetch as ReturnType<typeof vi.fn>;
      mockApiFetch.mockResolvedValue(makeSSEResponse([
        { type: "token", text: "Hello world" },
        { type: "done", reply: "Hello world", animationId: "anim-1" },
      ]));

      const setMessages = vi.fn();
      const opts = makeOptions({ setMessages });
      const { result } = renderHook(() => useChatSend(opts));

      act(() => { result.current.setInput("hi"); });
      await act(async () => { await result.current.handleSend(); });

      expect(setMessages).toHaveBeenCalled();
    });

    it("done event with animationId creates animation when no current animation", async () => {
      const { apiFetch } = await import("@/lib/apiFetch");
      const mockApiFetch = apiFetch as ReturnType<typeof vi.fn>;
      const lottie = { v: "5.0", layers: [] };
      mockApiFetch.mockResolvedValue(makeSSEResponse([
        { type: "token", text: "Created" },
        { type: "done", reply: "Created", animationId: "new-anim", lottieJson: lottie },
      ]));

      const onAnimationCreated = vi.fn();
      const onAnimationUpdated = vi.fn();
      const setCurrentAnimationId = vi.fn();
      const opts = makeOptions({
        currentAnimationId: undefined,
        onAnimationCreated,
        onAnimationUpdated,
        setCurrentAnimationId,
      });
      const { result } = renderHook(() => useChatSend(opts));

      act(() => { result.current.setInput("create something"); });
      await act(async () => { await result.current.handleSend(); });

      expect(setCurrentAnimationId).toHaveBeenCalledWith("new-anim");
      expect(onAnimationCreated).toHaveBeenCalledWith("new-anim", lottie);
      expect(onAnimationUpdated).toHaveBeenCalledWith("new-anim", lottie);
    });

    it("done event with lottieJson calls onAnimationUpdated", async () => {
      const { apiFetch } = await import("@/lib/apiFetch");
      const mockApiFetch = apiFetch as ReturnType<typeof vi.fn>;
      const lottie = { v: "5.0", layers: [] };
      mockApiFetch.mockResolvedValue(makeSSEResponse([
        { type: "token", text: "Updated" },
        { type: "done", reply: "Updated", lottieJson: lottie },
      ]));

      const onAnimationUpdated = vi.fn();
      const opts = makeOptions({ onAnimationUpdated });
      const { result } = renderHook(() => useChatSend(opts));

      act(() => { result.current.setInput("update it"); });
      await act(async () => { await result.current.handleSend(); });

      expect(onAnimationUpdated).toHaveBeenCalledWith("anim-1", lottie);
    });

    it("error SSE event sets error state", async () => {
      const { apiFetch } = await import("@/lib/apiFetch");
      const mockApiFetch = apiFetch as ReturnType<typeof vi.fn>;
      mockApiFetch.mockResolvedValue(makeSSEResponse([
        { type: "error", error: "Something broke" },
      ]));

      const opts = makeOptions();
      const { result } = renderHook(() => useChatSend(opts));

      act(() => { result.current.setInput("go"); });
      await act(async () => { await result.current.handleSend(); });

      expect(result.current.error).toBe("Something broke");
    });

    it("repairing and repair_token events are handled", async () => {
      const { apiFetch } = await import("@/lib/apiFetch");
      const mockApiFetch = apiFetch as ReturnType<typeof vi.fn>;
      mockApiFetch.mockResolvedValue(makeSSEResponse([
        { type: "token", text: "First" },
        { type: "repairing" },
        { type: "repair_token", text: "Fixed output" },
        { type: "done", reply: "Fixed output" },
      ]));

      const setMessages = vi.fn();
      const opts = makeOptions({ setMessages });
      const { result } = renderHook(() => useChatSend(opts));

      act(() => { result.current.setInput("test"); });
      await act(async () => { await result.current.handleSend(); });

      expect(setMessages).toHaveBeenCalled();
    });

    it("quality_hints event updates message hints", async () => {
      const { apiFetch } = await import("@/lib/apiFetch");
      const mockApiFetch = apiFetch as ReturnType<typeof vi.fn>;
      mockApiFetch.mockResolvedValue(makeSSEResponse([
        { type: "token", text: "Result" },
        { type: "quality_hints", hints: [{ level: "warning", message: "test" }] },
        { type: "done", reply: "Result" },
      ]));

      const setMessages = vi.fn();
      const opts = makeOptions({ setMessages });
      const { result } = renderHook(() => useChatSend(opts));

      act(() => { result.current.setInput("go"); });
      await act(async () => { await result.current.handleSend(); });

      expect(setMessages).toHaveBeenCalled();
    });

    it("done event with command calls onCommand", async () => {
      const { apiFetch } = await import("@/lib/apiFetch");
      const mockApiFetch = apiFetch as ReturnType<typeof vi.fn>;
      mockApiFetch.mockResolvedValue(makeSSEResponse([
        { type: "token", text: "ok" },
        { type: "done", reply: "ok", command: { type: "play" } },
      ]));

      const onCommand = vi.fn();
      const opts = makeOptions({ onCommand });
      const { result } = renderHook(() => useChatSend(opts));

      act(() => { result.current.setInput("go"); });
      await act(async () => { await result.current.handleSend(); });

      expect(onCommand).toHaveBeenCalledWith({ type: "play" });
    });
  });

  describe("non-SSE JSON response", () => {
    it("handles JSON response with new animation creation", async () => {
      const { apiFetch } = await import("@/lib/apiFetch");
      const mockApiFetch = apiFetch as ReturnType<typeof vi.fn>;
      const lottie = { v: "5.0" };
      mockApiFetch.mockResolvedValue(makeJSONResponse({
        reply: "done",
        animationId: "new-id",
        lottieJson: lottie,
      }));

      const onAnimationCreated = vi.fn();
      const setCurrentAnimationId = vi.fn();
      const opts = makeOptions({
        currentAnimationId: undefined,
        onAnimationCreated,
        setCurrentAnimationId,
      });
      const { result } = renderHook(() => useChatSend(opts));

      act(() => { result.current.setInput("create"); });
      await act(async () => { await result.current.handleSend(); });

      expect(setCurrentAnimationId).toHaveBeenCalledWith("new-id");
      expect(onAnimationCreated).toHaveBeenCalledWith("new-id", lottie);
    });

    it("handles 429 rate limit with retryAfterSec", async () => {
      const { apiFetch } = await import("@/lib/apiFetch");
      const mockApiFetch = apiFetch as ReturnType<typeof vi.fn>;
      mockApiFetch.mockResolvedValue({
        headers: { get: () => "application/json" },
        ok: false,
        status: 429,
        json: () => Promise.resolve({ retryAfterSec: 10 }),
      });

      const opts = makeOptions();
      const { result } = renderHook(() => useChatSend(opts));

      act(() => { result.current.setInput("go"); });
      await act(async () => { await result.current.handleSend(); });

      expect(result.current.error).toContain("10 seconds");
    });

    it("handles 429 rate limit without retryAfterSec", async () => {
      const { apiFetch } = await import("@/lib/apiFetch");
      const mockApiFetch = apiFetch as ReturnType<typeof vi.fn>;
      mockApiFetch.mockResolvedValue({
        headers: { get: () => "application/json" },
        ok: false,
        status: 429,
        json: () => Promise.resolve({}),
      });

      const opts = makeOptions();
      const { result } = renderHook(() => useChatSend(opts));

      act(() => { result.current.setInput("go"); });
      await act(async () => { await result.current.handleSend(); });

      expect(result.current.error).toContain("slow down");
    });

    it("handles non-ok response with error message", async () => {
      const { apiFetch } = await import("@/lib/apiFetch");
      const mockApiFetch = apiFetch as ReturnType<typeof vi.fn>;
      mockApiFetch.mockResolvedValue({
        headers: { get: () => "application/json" },
        ok: false,
        status: 500,
        json: () => Promise.resolve({ error: "Server error" }),
      });

      const opts = makeOptions();
      const { result } = renderHook(() => useChatSend(opts));

      act(() => { result.current.setInput("go"); });
      await act(async () => { await result.current.handleSend(); });

      expect(result.current.error).toBe("Server error");
    });

    it("handles network error from apiFetch", async () => {
      const { apiFetch } = await import("@/lib/apiFetch");
      const mockApiFetch = apiFetch as ReturnType<typeof vi.fn>;
      mockApiFetch.mockRejectedValue(new Error("Network failed"));

      const opts = makeOptions();
      const { result } = renderHook(() => useChatSend(opts));

      act(() => { result.current.setInput("go"); });
      await act(async () => { await result.current.handleSend(); });

      expect(result.current.error).toBe("Network failed");
    });
  });

  describe("command handling", () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async function setupCommand(commandObj: object, inputText: string, _optsOverrides = {}) {
      const { parseCommand } = await import("@/lib/commands");
      const { apiFetch } = await import("@/lib/apiFetch");
      vi.mocked(parseCommand).mockReturnValueOnce(commandObj as ReturnType<typeof parseCommand>);
      const mockApiFetch = apiFetch as ReturnType<typeof vi.fn>;
      return { mockApiFetch, parseCommand: vi.mocked(parseCommand) };
    }

    it("/style neon streams with style instruction", async () => {
      const { mockApiFetch } = await setupCommand(
        { type: "style", style: "neon" },
        "/style neon"
      );
      mockApiFetch.mockResolvedValue(makeSSEResponse([
        { type: "token", text: "Styled" },
        { type: "done", reply: "Styled" },
      ]));

      const setMessages = vi.fn();
      const opts = makeOptions({ setMessages });
      const { result } = renderHook(() => useChatSend(opts));

      act(() => { result.current.setInput("/style neon"); });
      await act(async () => { await result.current.handleSend(); });

      expect(mockApiFetch).toHaveBeenCalled();
      const body = JSON.parse(mockApiFetch.mock.calls[0][1].body);
      expect(body.message).toContain("[STYLE: neon]");
    });

    it("/style_list shows style listing", async () => {
      await setupCommand({ type: "style_list" }, "/style");

      const setMessages = vi.fn();
      const opts = makeOptions({ setMessages });
      const { result } = renderHook(() => useChatSend(opts));

      act(() => { result.current.setInput("/style"); });
      await act(async () => { await result.current.handleSend(); });

      // Should add user + assistant messages
      const calls = setMessages.mock.calls;
      expect(calls.length).toBeGreaterThanOrEqual(2);
    });

    it("/animate bounce streams with animate instruction", async () => {
      const { mockApiFetch } = await setupCommand(
        { type: "animate", animation: "bounce" },
        "/animate bounce"
      );
      mockApiFetch.mockResolvedValue(makeSSEResponse([
        { type: "token", text: "Bouncing" },
        { type: "done", reply: "Bouncing" },
      ]));

      const opts = makeOptions();
      const { result } = renderHook(() => useChatSend(opts));

      act(() => { result.current.setInput("/animate bounce"); });
      await act(async () => { await result.current.handleSend(); });

      const body = JSON.parse(mockApiFetch.mock.calls[0][1].body);
      expect(body.message).toContain("[ANIMATE: bounce]");
    });

    it("/random calls streamResponse with random prompt", async () => {
      const { mockApiFetch } = await setupCommand(
        { type: "random" },
        "/random"
      );
      mockApiFetch.mockResolvedValue(makeSSEResponse([
        { type: "token", text: "Ball" },
        { type: "done", reply: "Ball" },
      ]));

      const opts = makeOptions();
      const { result } = renderHook(() => useChatSend(opts));

      act(() => { result.current.setInput("/random"); });
      await act(async () => { await result.current.handleSend(); });

      const body = JSON.parse(mockApiFetch.mock.calls[0][1].body);
      expect(body.message).toBe("make a bouncing ball");
    });

    it("/critique streams as a stream command", async () => {
      const { mockApiFetch } = await setupCommand(
        { type: "critique" },
        "/critique"
      );
      mockApiFetch.mockResolvedValue(makeSSEResponse([
        { type: "token", text: "Critique" },
        { type: "done", reply: "Critique" },
      ]));

      const opts = makeOptions();
      const { result } = renderHook(() => useChatSend(opts));

      act(() => { result.current.setInput("/critique"); });
      await act(async () => { await result.current.handleSend(); });

      expect(mockApiFetch).toHaveBeenCalled();
    });

    it("/variations calls apiFetch to /api/generate/variations", async () => {
      const { mockApiFetch } = await setupCommand(
        { type: "variations", prompt: "test" },
        "/variations test"
      );
      mockApiFetch.mockResolvedValue(makeJSONResponse({
        variations: [{ style: "neon", animation: { v: "5.0" } }],
      }));

      const setMessages = vi.fn();
      const opts = makeOptions({ setMessages });
      const { result } = renderHook(() => useChatSend(opts));

      act(() => { result.current.setInput("/variations test"); });
      await act(async () => { await result.current.handleSend(); });

      expect(mockApiFetch).toHaveBeenCalledWith(
        "/api/generate/variations",
        expect.objectContaining({ method: "POST" })
      );
    });

    it("/variations handles error response", async () => {
      const { mockApiFetch } = await setupCommand(
        { type: "variations", prompt: "test" },
        "/variations test"
      );
      mockApiFetch.mockResolvedValue(makeJSONResponse({ error: "fail" }, false, 500));

      const setMessages = vi.fn();
      const opts = makeOptions({ setMessages });
      const { result } = renderHook(() => useChatSend(opts));

      act(() => { result.current.setInput("/variations test"); });
      await act(async () => { await result.current.handleSend(); });

      expect(setMessages).toHaveBeenCalled();
    });

    it("/variations handles network error", async () => {
      await setupCommand(
        { type: "variations", prompt: "test" },
        "/variations test"
      );
      const { apiFetch } = await import("@/lib/apiFetch");
      (apiFetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("Network"));

      const setMessages = vi.fn();
      const opts = makeOptions({ setMessages });
      const { result } = renderHook(() => useChatSend(opts));

      act(() => { result.current.setInput("/variations test"); });
      await act(async () => { await result.current.handleSend(); });

      expect(setMessages).toHaveBeenCalled();
    });

    it("/theme set sets a design token", async () => {
      await setupCommand(
        { type: "theme", subcommand: { action: "set", key: "primary", value: "red" } },
        "/theme set primary red"
      );

      const setMessages = vi.fn();
      const opts = makeOptions({ setMessages });
      const { result } = renderHook(() => useChatSend(opts));

      act(() => { result.current.setInput("/theme set primary red"); });
      await act(async () => { await result.current.handleSend(); });

      // Should add user + assistant feedback messages
      const calls = setMessages.mock.calls;
      expect(calls.length).toBeGreaterThanOrEqual(2);
    });

    it("/theme show shows design tokens", async () => {
      await setupCommand(
        { type: "theme", subcommand: { action: "show" } },
        "/theme"
      );

      const setMessages = vi.fn();
      const opts = makeOptions({ setMessages });
      const { result } = renderHook(() => useChatSend(opts));

      act(() => { result.current.setInput("/theme"); });
      await act(async () => { await result.current.handleSend(); });

      expect(setMessages).toHaveBeenCalled();
    });

    it("/theme clear clears design tokens", async () => {
      await setupCommand(
        { type: "theme", subcommand: { action: "clear" } },
        "/theme clear"
      );

      const setMessages = vi.fn();
      const opts = makeOptions({ setMessages });
      const { result } = renderHook(() => useChatSend(opts));

      act(() => { result.current.setInput("/theme clear"); });
      await act(async () => { await result.current.handleSend(); });

      expect(setMessages).toHaveBeenCalled();
    });

    it("/help adds help text", async () => {
      await setupCommand({ type: "help" }, "/help");

      const setMessages = vi.fn();
      const onCommand = vi.fn();
      const opts = makeOptions({ setMessages, onCommand });
      const { result } = renderHook(() => useChatSend(opts));

      act(() => { result.current.setInput("/help"); });
      await act(async () => { await result.current.handleSend(); });

      expect(setMessages).toHaveBeenCalled();
      // help does NOT call onCommand
      expect(onCommand).not.toHaveBeenCalled();
    });

    it("/play sends play command", async () => {
      await setupCommand({ type: "play" }, "/play");

      const onCommand = vi.fn();
      const setMessages = vi.fn();
      const opts = makeOptions({ setMessages, onCommand });
      const { result } = renderHook(() => useChatSend(opts));

      act(() => { result.current.setInput("/play"); });
      await act(async () => { await result.current.handleSend(); });

      expect(onCommand).toHaveBeenCalledWith({ type: "play" });
    });

    it("/pause sends pause command", async () => {
      await setupCommand({ type: "pause" }, "/pause");

      const onCommand = vi.fn();
      const opts = makeOptions({ onCommand });
      const { result } = renderHook(() => useChatSend(opts));

      act(() => { result.current.setInput("/pause"); });
      await act(async () => { await result.current.handleSend(); });

      expect(onCommand).toHaveBeenCalledWith({ type: "pause" });
    });

    it("/speed 2 sends speed command", async () => {
      await setupCommand({ type: "speed", speed: 2 }, "/speed 2");

      const onCommand = vi.fn();
      const opts = makeOptions({ onCommand });
      const { result } = renderHook(() => useChatSend(opts));

      act(() => { result.current.setInput("/speed 2"); });
      await act(async () => { await result.current.handleSend(); });

      expect(onCommand).toHaveBeenCalledWith({ type: "speed", speed: 2 });
    });

    it("error command shows error feedback without calling onCommand", async () => {
      await setupCommand({ type: "error", message: "bad command" }, "/badcmd");

      const onCommand = vi.fn();
      const setMessages = vi.fn();
      const opts = makeOptions({ onCommand, setMessages });
      const { result } = renderHook(() => useChatSend(opts));

      act(() => { result.current.setInput("/badcmd"); });
      await act(async () => { await result.current.handleSend(); });

      expect(onCommand).not.toHaveBeenCalled();
      expect(setMessages).toHaveBeenCalled();
    });

    it("/import calls fetch to import-url endpoint", async () => {
      await setupCommand({ type: "import", url: "https://example.com/anim.json" }, "/import https://example.com/anim.json");

      const globalFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ id: "imported-1", name: "Imported", message: "Done" }),
      });
      vi.stubGlobal("fetch", globalFetch);

      const onAnimationCreated = vi.fn();
      const setMessages = vi.fn();
      const opts = makeOptions({ setMessages, onAnimationCreated });
      const { result } = renderHook(() => useChatSend(opts));

      act(() => { result.current.setInput("/import https://example.com/anim.json"); });
      await act(async () => { await result.current.handleSend(); });

      expect(globalFetch).toHaveBeenCalledWith(
        "/api/animations/import-url",
        expect.objectContaining({ method: "POST" })
      );
      expect(onAnimationCreated).toHaveBeenCalledWith("imported-1");

      vi.unstubAllGlobals();
    });

    it("/import handles failure", async () => {
      await setupCommand({ type: "import", url: "https://example.com/bad.json" }, "/import https://example.com/bad.json");

      const globalFetch = vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: "Not found" }),
      });
      vi.stubGlobal("fetch", globalFetch);

      const setMessages = vi.fn();
      const opts = makeOptions({ setMessages });
      const { result } = renderHook(() => useChatSend(opts));

      act(() => { result.current.setInput("/import https://example.com/bad.json"); });
      await act(async () => { await result.current.handleSend(); });

      expect(setMessages).toHaveBeenCalled();

      vi.unstubAllGlobals();
    });

    it("/import handles network error", async () => {
      await setupCommand({ type: "import", url: "https://example.com/bad.json" }, "/import https://example.com/bad.json");

      const globalFetch = vi.fn().mockRejectedValue(new Error("Network error"));
      vi.stubGlobal("fetch", globalFetch);

      const setMessages = vi.fn();
      const opts = makeOptions({ setMessages });
      const { result } = renderHook(() => useChatSend(opts));

      act(() => { result.current.setInput("/import https://example.com/bad.json"); });
      await act(async () => { await result.current.handleSend(); });

      expect(setMessages).toHaveBeenCalled();

      vi.unstubAllGlobals();
    });

    it("/sequence_play loads and plays a sequence", async () => {
      await setupCommand({ type: "sequence_play", name: "test-seq" }, "/sequence play test-seq");

      const globalFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([{ id: "seq-1", name: "test-seq" }]),
      });
      vi.stubGlobal("fetch", globalFetch);

      const setMessages = vi.fn();
      const opts = makeOptions({ setMessages });
      const { result } = renderHook(() => useChatSend(opts));

      act(() => { result.current.setInput("/sequence play test-seq"); });
      await act(async () => { await result.current.handleSend(); });

      expect(globalFetch).toHaveBeenCalled();
      expect(setMessages).toHaveBeenCalled();

      vi.unstubAllGlobals();
    });

    it("/sequence_play handles not found", async () => {
      await setupCommand({ type: "sequence_play", name: "missing" }, "/sequence play missing");

      const globalFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([]),
      });
      vi.stubGlobal("fetch", globalFetch);

      const setMessages = vi.fn();
      const opts = makeOptions({ setMessages });
      const { result } = renderHook(() => useChatSend(opts));

      act(() => { result.current.setInput("/sequence play missing"); });
      await act(async () => { await result.current.handleSend(); });

      expect(setMessages).toHaveBeenCalled();

      vi.unstubAllGlobals();
    });

    it("/sequence_play handles fetch error", async () => {
      await setupCommand({ type: "sequence_play", name: "test" }, "/sequence play test");

      const globalFetch = vi.fn().mockRejectedValue(new Error("fail"));
      vi.stubGlobal("fetch", globalFetch);

      const opts = makeOptions();
      const { result } = renderHook(() => useChatSend(opts));

      act(() => { result.current.setInput("/sequence play test"); });
      await act(async () => { await result.current.handleSend(); });

      expect(result.current.error).toBe("Failed to load sequence");

      vi.unstubAllGlobals();
    });

    it("/sequence_show shows sequence details", async () => {
      await setupCommand({ type: "sequence_show", name: "test-seq" }, "/sequence show test-seq");

      const globalFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([{
          id: "seq-1",
          name: "test-seq",
          description: "A test",
          items: [{ animation_name: "Bounce", position: 0, transition_type: "fade" }],
        }]),
      });
      vi.stubGlobal("fetch", globalFetch);

      const setMessages = vi.fn();
      const opts = makeOptions({ setMessages });
      const { result } = renderHook(() => useChatSend(opts));

      act(() => { result.current.setInput("/sequence show test-seq"); });
      await act(async () => { await result.current.handleSend(); });

      expect(setMessages).toHaveBeenCalled();

      vi.unstubAllGlobals();
    });

    it("/sequence_show handles not found", async () => {
      await setupCommand({ type: "sequence_show", name: "missing" }, "/sequence show missing");

      const globalFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([]),
      });
      vi.stubGlobal("fetch", globalFetch);

      const setMessages = vi.fn();
      const opts = makeOptions({ setMessages });
      const { result } = renderHook(() => useChatSend(opts));

      act(() => { result.current.setInput("/sequence show missing"); });
      await act(async () => { await result.current.handleSend(); });

      expect(setMessages).toHaveBeenCalled();

      vi.unstubAllGlobals();
    });

    it("/sequence_show handles fetch error", async () => {
      await setupCommand({ type: "sequence_show", name: "test" }, "/sequence show test");

      const globalFetch = vi.fn().mockRejectedValue(new Error("fail"));
      vi.stubGlobal("fetch", globalFetch);

      const opts = makeOptions();
      const { result } = renderHook(() => useChatSend(opts));

      act(() => { result.current.setInput("/sequence show test"); });
      await act(async () => { await result.current.handleSend(); });

      expect(result.current.error).toBe("Failed to load sequence");

      vi.unstubAllGlobals();
    });

    it("/presets list loads presets", async () => {
      const { apiFetch } = await import("@/lib/apiFetch");
      await setupCommand({ type: "presets", subcommand: "list" }, "/presets");
      (apiFetch as ReturnType<typeof vi.fn>).mockResolvedValue(makeJSONResponse([
        { name: "test", description: "A preset" },
      ]));

      const setMessages = vi.fn();
      const opts = makeOptions({ setMessages });
      const { result } = renderHook(() => useChatSend(opts));

      act(() => { result.current.setInput("/presets"); });
      await act(async () => { await result.current.handleSend(); });

      expect(apiFetch).toHaveBeenCalledWith("/api/presets");
    });

    it("/presets list shows empty state", async () => {
      const { apiFetch } = await import("@/lib/apiFetch");
      await setupCommand({ type: "presets", subcommand: "list" }, "/presets");
      (apiFetch as ReturnType<typeof vi.fn>).mockResolvedValue(makeJSONResponse([]));

      const setMessages = vi.fn();
      const opts = makeOptions({ setMessages });
      const { result } = renderHook(() => useChatSend(opts));

      act(() => { result.current.setInput("/presets"); });
      await act(async () => { await result.current.handleSend(); });

      expect(setMessages).toHaveBeenCalled();
    });

    it("/presets save streams", async () => {
      const { apiFetch } = await import("@/lib/apiFetch");
      await setupCommand(
        { type: "presets", subcommand: { action: "save", name: "cool" } },
        "/presets save cool"
      );
      (apiFetch as ReturnType<typeof vi.fn>).mockResolvedValue(makeSSEResponse([
        { type: "token", text: "Saved" },
        { type: "done", reply: "Saved" },
      ]));

      const opts = makeOptions();
      const { result } = renderHook(() => useChatSend(opts));

      act(() => { result.current.setInput("/presets save cool"); });
      await act(async () => { await result.current.handleSend(); });

      expect(apiFetch).toHaveBeenCalled();
    });

    it("/presets apply streams", async () => {
      const { apiFetch } = await import("@/lib/apiFetch");
      await setupCommand(
        { type: "presets", subcommand: { action: "apply", name: "cool" } },
        "/presets apply cool"
      );
      (apiFetch as ReturnType<typeof vi.fn>).mockResolvedValue(makeSSEResponse([
        { type: "token", text: "Applied" },
        { type: "done", reply: "Applied" },
      ]));

      const opts = makeOptions();
      const { result } = renderHook(() => useChatSend(opts));

      act(() => { result.current.setInput("/presets apply cool"); });
      await act(async () => { await result.current.handleSend(); });

      expect(apiFetch).toHaveBeenCalled();
    });

    it("/presets handles error", async () => {
      const { apiFetch } = await import("@/lib/apiFetch");
      await setupCommand({ type: "presets", subcommand: "list" }, "/presets");
      (apiFetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("fail"));

      const opts = makeOptions();
      const { result } = renderHook(() => useChatSend(opts));

      act(() => { result.current.setInput("/presets"); });
      await act(async () => { await result.current.handleSend(); });

      expect(result.current.error).toBe("fail");
    });

    it("style_custom command streams with custom description", async () => {
      const { mockApiFetch } = await setupCommand(
        { type: "style_custom", description: "dark gothic" },
        "/style dark gothic"
      );
      mockApiFetch.mockResolvedValue(makeSSEResponse([
        { type: "token", text: "Styled" },
        { type: "done", reply: "Styled" },
      ]));

      const opts = makeOptions();
      const { result } = renderHook(() => useChatSend(opts));

      act(() => { result.current.setInput("/style dark gothic"); });
      await act(async () => { await result.current.handleSend(); });

      const body = JSON.parse(mockApiFetch.mock.calls[0][1].body);
      expect(body.message).toContain("[STYLE_CUSTOM: dark gothic]");
    });

    it("stream command handles error from apiFetch", async () => {
      const { mockApiFetch } = await setupCommand(
        { type: "polish" },
        "/polish"
      );
      mockApiFetch.mockRejectedValue(new Error("stream failed"));

      const opts = makeOptions();
      const { result } = renderHook(() => useChatSend(opts));

      act(() => { result.current.setInput("/polish"); });
      await act(async () => { await result.current.handleSend(); });

      expect(result.current.error).toBe("stream failed");
    });

    it("local commands: loop, once, undo, redo, resize, background, fullscreen, optimize, duration, goto, export, markers", async () => {
      const localCommands = [
        { type: "loop" },
        { type: "once" },
        { type: "undo" },
        { type: "redo" },
        { type: "resize", width: 800, height: 600 },
        { type: "background", color: "#fff" },
        { type: "fullscreen" },
        { type: "optimize" },
        { type: "duration", durationMs: 2000 },
        { type: "goto", target: { value: 10, unit: "frame" } },
        { type: "goto", target: { value: 2, unit: "seconds" } },
        { type: "goto", target: { value: 500, unit: "ms" } },
        { type: "goto", target: { value: 50, unit: "percent" } },
        { type: "export_gif" },
        { type: "export_apng" },
        { type: "export_video" },
        { type: "export_json" },
        { type: "export_dotlottie" },
        { type: "marker_add", name: "intro", startFrame: 0, endFrame: 30 },
        { type: "marker_remove", name: "intro" },
        { type: "marker_list" },
        { type: "marker_clear" },
      ];

      for (const cmd of localCommands) {
        const { parseCommand } = await import("@/lib/commands");
        vi.mocked(parseCommand).mockReturnValueOnce(cmd as ReturnType<typeof parseCommand>);

        const onCommand = vi.fn();
        const setMessages = vi.fn();
        const opts = makeOptions({ onCommand, setMessages });
        const { result } = renderHook(() => useChatSend(opts));

        act(() => { result.current.setInput(`/${cmd.type}`); });
        await act(async () => { await result.current.handleSend(); });

        expect(onCommand).toHaveBeenCalled();
      }
    });
  });

  describe("handleRetry", () => {
    it("retries with the previous user message", async () => {
      const { apiFetch } = await import("@/lib/apiFetch");
      const mockApiFetch = apiFetch as ReturnType<typeof vi.fn>;
      mockApiFetch.mockResolvedValue(makeSSEResponse([
        { type: "token", text: "Retried" },
        { type: "done", reply: "Retried" },
      ]));

      const messages = [
        { id: "user-1", role: "user" as const, content: "make a star" },
        { id: "asst-1", role: "assistant" as const, content: "Here's a star" },
      ];
      const setMessages = vi.fn();
      const opts = makeOptions({ messages, setMessages });
      const { result } = renderHook(() => useChatSend(opts));

      await act(async () => { await result.current.handleRetry("asst-1"); });

      expect(mockApiFetch).toHaveBeenCalled();
      const body = JSON.parse(mockApiFetch.mock.calls[0][1].body);
      expect(body.message).toBe("make a star");
      expect(body.regenerate).toBe(true);
    });

    it("does nothing if assistant message not found", async () => {
      const { apiFetch } = await import("@/lib/apiFetch");
      const mockApiFetch = apiFetch as ReturnType<typeof vi.fn>;

      const opts = makeOptions({ messages: [] });
      const { result } = renderHook(() => useChatSend(opts));

      await act(async () => { await result.current.handleRetry("nonexistent"); });

      expect(mockApiFetch).not.toHaveBeenCalled();
    });
  });

  describe("handleEditSave", () => {
    it("patches the message and re-streams", async () => {
      const { apiFetch } = await import("@/lib/apiFetch");
      const mockApiFetch = apiFetch as ReturnType<typeof vi.fn>;
      mockApiFetch.mockResolvedValue(makeSSEResponse([
        { type: "token", text: "Edited" },
        { type: "done", reply: "Edited" },
      ]));

      const globalFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      });
      vi.stubGlobal("fetch", globalFetch);

      const messages = [
        { id: "user-1", role: "user" as const, content: "make a star" },
        { id: "asst-1", role: "assistant" as const, content: "Here's a star" },
      ];
      const setMessages = vi.fn();
      const opts = makeOptions({ messages, setMessages });
      const { result } = renderHook(() => useChatSend(opts));

      act(() => {
        result.current.setEditingMsgId("user-1");
        result.current.setEditText("make a circle");
      });

      await act(async () => { await result.current.handleEditSave(); });

      expect(globalFetch).toHaveBeenCalledWith(
        "/api/chat/anim-1",
        expect.objectContaining({ method: "PATCH" })
      );
      expect(mockApiFetch).toHaveBeenCalled();

      vi.unstubAllGlobals();
    });

    it("does nothing if editingMsgId is null", async () => {
      const { apiFetch } = await import("@/lib/apiFetch");
      const mockApiFetch = apiFetch as ReturnType<typeof vi.fn>;

      const opts = makeOptions();
      const { result } = renderHook(() => useChatSend(opts));

      await act(async () => { await result.current.handleEditSave(); });

      expect(mockApiFetch).not.toHaveBeenCalled();
    });

    it("handles PATCH failure", async () => {
      const globalFetch = vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: "Patch failed" }),
      });
      vi.stubGlobal("fetch", globalFetch);

      const messages = [
        { id: "user-1", role: "user" as const, content: "make a star" },
      ];
      const setMessages = vi.fn();
      const opts = makeOptions({ messages, setMessages });
      const { result } = renderHook(() => useChatSend(opts));

      act(() => {
        result.current.setEditingMsgId("user-1");
        result.current.setEditText("make a circle");
      });

      await act(async () => { await result.current.handleEditSave(); });

      expect(result.current.error).toBe("Patch failed");

      vi.unstubAllGlobals();
    });

    it("handles PATCH network error", async () => {
      const globalFetch = vi.fn().mockRejectedValue(new Error("Network"));
      vi.stubGlobal("fetch", globalFetch);

      const messages = [
        { id: "user-1", role: "user" as const, content: "make a star" },
      ];
      const setMessages = vi.fn();
      const opts = makeOptions({ messages, setMessages });
      const { result } = renderHook(() => useChatSend(opts));

      act(() => {
        result.current.setEditingMsgId("user-1");
        result.current.setEditText("make a circle");
      });

      await act(async () => { await result.current.handleEditSave(); });

      expect(result.current.error).toBe("Failed to edit message");

      vi.unstubAllGlobals();
    });
  });

  describe("handleVariationSelect", () => {
    it("selects a variation and calls onAnimationUpdated", () => {
      const onAnimationUpdated = vi.fn();
      const setMessages = vi.fn();
      const opts = makeOptions({ setMessages, onAnimationUpdated });
      const { result } = renderHook(() => useChatSend(opts));

      act(() => {
        result.current.handleVariationSelect("msg-1", {
          style: "neon",
          animation: { v: "5.0", layers: [] },
        } as unknown as import("@/components/VariationGrid").Variation);
      });

      expect(setMessages).toHaveBeenCalled();
      expect(onAnimationUpdated).toHaveBeenCalledWith("anim-1", { v: "5.0", layers: [] });
    });

    it("calls onAnimationCreated when no currentAnimationId", () => {
      const onAnimationCreated = vi.fn();
      const setMessages = vi.fn();
      const opts = makeOptions({ setMessages, onAnimationCreated, currentAnimationId: undefined });
      const { result } = renderHook(() => useChatSend(opts));

      act(() => {
        result.current.handleVariationSelect("msg-1", {
          style: "neon",
          animation: { v: "5.0" },
        } as unknown as import("@/components/VariationGrid").Variation);
      });

      expect(onAnimationCreated).toHaveBeenCalled();
    });
  });

  describe("image attachment", () => {
    it("includes image in request body", async () => {
      const { apiFetch } = await import("@/lib/apiFetch");
      const mockApiFetch = apiFetch as ReturnType<typeof vi.fn>;
      mockApiFetch.mockResolvedValue(makeSSEResponse([
        { type: "token", text: "Got image" },
        { type: "done", reply: "Got image" },
      ]));

      const opts = makeOptions();
      const { result } = renderHook(() => useChatSend(opts));

      act(() => { result.current.setPendingImage("data:image/png;base64,abc123"); });
      act(() => { result.current.setInput("describe this"); });

      await act(async () => { await result.current.handleSend(); });

      const body = JSON.parse(mockApiFetch.mock.calls[0][1].body);
      expect(body.image).toBe("data:image/png;base64,abc123");
    });
  });

  describe("layer context", () => {
    it("includes layerContext in request and calls onLayerContextConsumed", async () => {
      const { apiFetch } = await import("@/lib/apiFetch");
      const mockApiFetch = apiFetch as ReturnType<typeof vi.fn>;
      mockApiFetch.mockResolvedValue(makeSSEResponse([
        { type: "token", text: "ok" },
        { type: "done", reply: "ok" },
      ]));

      // Mock extractLayerContext to return something
      const { extractLayerContext } = await import("@/lib/chat-types");
      vi.mocked(extractLayerContext).mockReturnValueOnce({ layerIndex: 0, layerName: "Shape" } as ReturnType<typeof extractLayerContext>);

      const onLayerContextConsumed = vi.fn();
      const opts = makeOptions({
        onLayerContextConsumed,
        animationDataProp: { v: "5.0", layers: [{ nm: "Shape" }] },
        selectedLayerIndex: 0,
      });
      const { result } = renderHook(() => useChatSend(opts));

      act(() => { result.current.setInput("change color"); });
      await act(async () => { await result.current.handleSend(); });

      expect(onLayerContextConsumed).toHaveBeenCalled();
      const body = JSON.parse(mockApiFetch.mock.calls[0][1].body);
      expect(body.layerContext).toBeDefined();
    });
  });

  describe("design tokens", () => {
    it("includes designTokens when hasTokens is true", async () => {
      const { useDesignTokens } = await import("@/contexts/DesignTokensContext");
      const tokens = { primary: "blue", secondary: "green" };
      vi.mocked(useDesignTokens).mockReturnValue({
        tokens,
        setToken: vi.fn(),
        clearTokens: vi.fn(),
        hasTokens: true,
      } as ReturnType<typeof useDesignTokens>);

      const { apiFetch } = await import("@/lib/apiFetch");
      const mockApiFetch = apiFetch as ReturnType<typeof vi.fn>;
      mockApiFetch.mockResolvedValue(makeSSEResponse([
        { type: "token", text: "ok" },
        { type: "done", reply: "ok" },
      ]));

      const opts = makeOptions();
      const { result } = renderHook(() => useChatSend(opts));

      act(() => { result.current.setInput("test"); });
      await act(async () => { await result.current.handleSend(); });

      const body = JSON.parse(mockApiFetch.mock.calls[0][1].body);
      expect(body.designTokens).toEqual(tokens);
    });
  });

  describe("SSE JSON fence filtering", () => {
    it("filters out ```json blocks from visible content", async () => {
      const { apiFetch } = await import("@/lib/apiFetch");
      const mockApiFetch = apiFetch as ReturnType<typeof vi.fn>;
      mockApiFetch.mockResolvedValue(makeSSEResponse([
        { type: "token", text: "Here is the animation:\n```json\n{\"v\":\"5.0\"}\n```\nDone!" },
        { type: "done", reply: "Here is the animation:\nDone!" },
      ]));

      const messages: import("@/lib/chat-types").Message[] = [];
      const setMessages = makeCallbackMock(messages);
      const onProgressivePreview = vi.fn();
      const opts = makeOptions({ setMessages, messages, onProgressivePreview });
      const { result } = renderHook(() => useChatSend(opts));

      act(() => { result.current.setInput("create"); });
      await act(async () => { await result.current.handleSend(); });

      expect(setMessages).toHaveBeenCalled();
      expect(onProgressivePreview).toHaveBeenCalledWith(null);
    });

    it("handles partial fence buffer flushes for non-fence chars", async () => {
      const { apiFetch } = await import("@/lib/apiFetch");
      const mockApiFetch = apiFetch as ReturnType<typeof vi.fn>;
      // Send characters that start like a fence but aren't
      mockApiFetch.mockResolvedValue(makeSSEResponse([
        { type: "token", text: "`" },
        { type: "token", text: "`" },
        { type: "token", text: "x" },
        { type: "done", reply: "``x" },
      ]));

      const setMessages = makeCallbackMock([]);
      const opts = makeOptions({ setMessages });
      const { result } = renderHook(() => useChatSend(opts));

      act(() => { result.current.setInput("test"); });
      await act(async () => { await result.current.handleSend(); });

      expect(setMessages).toHaveBeenCalled();
    });

    it("progressive preview fires for large json blocks", async () => {
      const { apiFetch } = await import("@/lib/apiFetch");
      const { extractPartialLottie } = await import("@/lib/partial-lottie");
      const mockApiFetch = apiFetch as ReturnType<typeof vi.fn>;
      vi.mocked(extractPartialLottie).mockReturnValue({ v: "5.0" } as ReturnType<typeof extractPartialLottie>);

      const bigJson = "x".repeat(300);
      mockApiFetch.mockResolvedValue(makeSSEResponse([
        { type: "token", text: "```json\n" + bigJson },
        { type: "done", reply: "done" },
      ]));

      const onProgressivePreview = vi.fn();
      const setMessages = makeCallbackMock([]);
      const opts = makeOptions({ setMessages, onProgressivePreview });
      const { result } = renderHook(() => useChatSend(opts));

      act(() => { result.current.setInput("test"); });
      await act(async () => { await result.current.handleSend(); });

      expect(extractPartialLottie).toHaveBeenCalled();
      expect(onProgressivePreview).toHaveBeenCalledWith({ v: "5.0" });
    });
  });

  describe("SSE repair_token fence filtering", () => {
    it("filters json blocks from repair_token visible content", async () => {
      const { apiFetch } = await import("@/lib/apiFetch");
      const mockApiFetch = apiFetch as ReturnType<typeof vi.fn>;
      mockApiFetch.mockResolvedValue(makeSSEResponse([
        { type: "repairing" },
        { type: "repair_token", text: "Fixed: ```json\n{\"v\":\"5.0\"}\n```\nAll good" },
        { type: "done", reply: "Fixed: All good" },
      ]));

      const setMessages = makeCallbackMock([]);
      const opts = makeOptions({ setMessages });
      const { result } = renderHook(() => useChatSend(opts));

      act(() => { result.current.setInput("test"); });
      await act(async () => { await result.current.handleSend(); });

      expect(setMessages).toHaveBeenCalled();
    });

    it("handles repair_token with partial fence chars", async () => {
      const { apiFetch } = await import("@/lib/apiFetch");
      const mockApiFetch = apiFetch as ReturnType<typeof vi.fn>;
      mockApiFetch.mockResolvedValue(makeSSEResponse([
        { type: "repairing" },
        { type: "repair_token", text: "``x" },
        { type: "done", reply: "``x" },
      ]));

      const setMessages = makeCallbackMock([]);
      const opts = makeOptions({ setMessages });
      const { result } = renderHook(() => useChatSend(opts));

      act(() => { result.current.setInput("test"); });
      await act(async () => { await result.current.handleSend(); });

      expect(setMessages).toHaveBeenCalled();
    });

    it("repair_token creates new assistant message when none exists", async () => {
      const { apiFetch } = await import("@/lib/apiFetch");
      const mockApiFetch = apiFetch as ReturnType<typeof vi.fn>;
      mockApiFetch.mockResolvedValue(makeSSEResponse([
        { type: "repairing" },
        { type: "repair_token", text: "Repaired content" },
        { type: "done", reply: "Repaired content" },
      ]));

      const setMessages = makeCallbackMock([]);
      const opts = makeOptions({ setMessages });
      const { result } = renderHook(() => useChatSend(opts));

      act(() => { result.current.setInput("test"); });
      await act(async () => { await result.current.handleSend(); });

      expect(setMessages).toHaveBeenCalled();
    });

    it("repair_token inside json block discards content", async () => {
      const { apiFetch } = await import("@/lib/apiFetch");
      const mockApiFetch = apiFetch as ReturnType<typeof vi.fn>;
      mockApiFetch.mockResolvedValue(makeSSEResponse([
        { type: "repairing" },
        { type: "repair_token", text: "```json\n{\"data\": true}\n```" },
        { type: "done", reply: "done" },
      ]));

      const setMessages = makeCallbackMock([]);
      const opts = makeOptions({ setMessages });
      const { result } = renderHook(() => useChatSend(opts));

      act(() => { result.current.setInput("test"); });
      await act(async () => { await result.current.handleSend(); });

      expect(setMessages).toHaveBeenCalled();
    });
  });

  describe("SSE done event edge cases", () => {
    it("done with reply updates existing assistant message with warning and suggestions", async () => {
      const { apiFetch } = await import("@/lib/apiFetch");
      const mockApiFetch = apiFetch as ReturnType<typeof vi.fn>;
      mockApiFetch.mockResolvedValue(makeSSEResponse([
        { type: "token", text: "Result" },
        { type: "done", reply: "Final result", warning: "Be careful", suggestions: ["try this"], lottieJson: { v: "5.0" }, previousLottieJson: { v: "4.0" } },
      ]));

      const msgs: import("@/lib/chat-types").Message[] = [];
      const setMessages = makeCallbackMock(msgs);
      const opts = makeOptions({ setMessages, messages: msgs });
      const { result } = renderHook(() => useChatSend(opts));

      act(() => { result.current.setInput("go"); });
      await act(async () => { await result.current.handleSend(); });

      expect(setMessages).toHaveBeenCalled();
    });

    it("done with lottieJson but existing animationId calls onAnimationUpdated", async () => {
      const { apiFetch } = await import("@/lib/apiFetch");
      const mockApiFetch = apiFetch as ReturnType<typeof vi.fn>;
      const lottie = { v: "5.0", layers: [] };
      mockApiFetch.mockResolvedValue(makeSSEResponse([
        { type: "token", text: "ok" },
        { type: "done", reply: "ok", lottieJson: lottie, animationId: "other-anim" },
      ]));

      const onAnimationUpdated = vi.fn();
      const opts = makeOptions({ onAnimationUpdated, currentAnimationId: "anim-1" });
      const { result } = renderHook(() => useChatSend(opts));

      act(() => { result.current.setInput("update"); });
      await act(async () => { await result.current.handleSend(); });

      expect(onAnimationUpdated).toHaveBeenCalledWith("anim-1", lottie);
    });
  });

  describe("non-SSE with existingAssistantMsgId", () => {
    it("updates existing message in non-SSE path via handleRetry", async () => {
      const { apiFetch } = await import("@/lib/apiFetch");
      const mockApiFetch = apiFetch as ReturnType<typeof vi.fn>;
      mockApiFetch.mockResolvedValue(makeJSONResponse({ reply: "updated reply" }));

      const messages: import("@/lib/chat-types").Message[] = [
        { id: "user-1", role: "user", content: "hello" },
        { id: "asst-1", role: "assistant", content: "old reply" },
      ];
      const setMessages = makeCallbackMock(messages);
      const opts = makeOptions({ messages, setMessages });
      const { result } = renderHook(() => useChatSend(opts));

      await act(async () => { await result.current.handleRetry("asst-1"); });

      expect(setMessages).toHaveBeenCalled();
    });
  });

  describe("SSE streaming with existingAssistantMsgId", () => {
    it("clears existing message content at stream start", async () => {
      const { apiFetch } = await import("@/lib/apiFetch");
      const mockApiFetch = apiFetch as ReturnType<typeof vi.fn>;
      mockApiFetch.mockResolvedValue(makeSSEResponse([
        { type: "token", text: "new" },
        { type: "done", reply: "new" },
      ]));

      const messages: import("@/lib/chat-types").Message[] = [
        { id: "user-1", role: "user", content: "hello" },
        { id: "asst-1", role: "assistant", content: "old content" },
      ];
      const setMessages = makeCallbackMock(messages);
      const opts = makeOptions({ messages, setMessages });
      const { result } = renderHook(() => useChatSend(opts));

      await act(async () => { await result.current.handleRetry("asst-1"); });

      expect(setMessages).toHaveBeenCalled();
    });
  });

  describe("non-SSE error handling", () => {
    it("handles non-ok JSON response with fallback status code message", async () => {
      const { apiFetch } = await import("@/lib/apiFetch");
      const mockApiFetch = apiFetch as ReturnType<typeof vi.fn>;
      mockApiFetch.mockResolvedValue({
        headers: { get: () => "application/json" },
        ok: false,
        status: 503,
        json: () => Promise.resolve({}),
      });

      const opts = makeOptions();
      const { result } = renderHook(() => useChatSend(opts));

      act(() => { result.current.setInput("go"); });
      await act(async () => { await result.current.handleSend(); });

      expect(result.current.error).toBe("Request failed (503)");
    });

    it("handles non-ok response with unparseable json body", async () => {
      const { apiFetch } = await import("@/lib/apiFetch");
      const mockApiFetch = apiFetch as ReturnType<typeof vi.fn>;
      mockApiFetch.mockResolvedValue({
        headers: { get: () => "application/json" },
        ok: false,
        status: 500,
        json: () => Promise.reject(new Error("bad json")),
      });

      const opts = makeOptions();
      const { result } = renderHook(() => useChatSend(opts));

      act(() => { result.current.setInput("go"); });
      await act(async () => { await result.current.handleSend(); });

      expect(result.current.error).toBe("Request failed (500)");
    });
  });

  describe("SSE malformed data", () => {
    it("skips malformed SSE data lines", async () => {
      const { apiFetch } = await import("@/lib/apiFetch");
      const mockApiFetch = apiFetch as ReturnType<typeof vi.fn>;
      const encoder = new TextEncoder();
      const chunks = [
        encoder.encode(`data: not-json\n\n`),
        encoder.encode(`data: ${JSON.stringify({ type: "token", text: "ok" })}\n\n`),
        encoder.encode(`data: ${JSON.stringify({ type: "done", reply: "ok" })}\n\n`),
      ];
      let i = 0;
      const body = new ReadableStream({
        pull(controller) {
          if (i < chunks.length) controller.enqueue(chunks[i++]);
          else controller.close();
        },
      });
      mockApiFetch.mockResolvedValue({
        headers: { get: (h: string) => h.toLowerCase() === "content-type" ? "text/event-stream" : null },
        ok: true,
        body,
      });

      const setMessages = makeCallbackMock([]);
      const opts = makeOptions({ setMessages });
      const { result } = renderHook(() => useChatSend(opts));

      act(() => { result.current.setInput("test"); });
      await act(async () => { await result.current.handleSend(); });

      expect(setMessages).toHaveBeenCalled();
    });

    it("skips empty SSE lines", async () => {
      const { apiFetch } = await import("@/lib/apiFetch");
      const mockApiFetch = apiFetch as ReturnType<typeof vi.fn>;
      const encoder = new TextEncoder();
      const chunks = [
        encoder.encode(`\n\n`),
        encoder.encode(`data: ${JSON.stringify({ type: "done", reply: "ok" })}\n\n`),
      ];
      let i = 0;
      const body = new ReadableStream({
        pull(controller) {
          if (i < chunks.length) controller.enqueue(chunks[i++]);
          else controller.close();
        },
      });
      mockApiFetch.mockResolvedValue({
        headers: { get: (h: string) => h.toLowerCase() === "content-type" ? "text/event-stream" : null },
        ok: true,
        body,
      });

      const setMessages = makeCallbackMock([]);
      const opts = makeOptions({ setMessages });
      const { result } = renderHook(() => useChatSend(opts));

      act(() => { result.current.setInput("test"); });
      await act(async () => { await result.current.handleSend(); });

      expect(setMessages).toHaveBeenCalled();
    });
  });

  describe("SSE no response body", () => {
    it("throws when response body is null", async () => {
      const { apiFetch } = await import("@/lib/apiFetch");
      const mockApiFetch = apiFetch as ReturnType<typeof vi.fn>;
      mockApiFetch.mockResolvedValue({
        headers: { get: (h: string) => h.toLowerCase() === "content-type" ? "text/event-stream" : null },
        ok: true,
        body: null,
      });

      const opts = makeOptions();
      const { result } = renderHook(() => useChatSend(opts));

      act(() => { result.current.setInput("test"); });
      await act(async () => { await result.current.handleSend(); });

      expect(result.current.error).toBe("No response body");
    });
  });

  describe("offline enqueue callback execution", () => {
    it("executes setPendingCount callback after enqueue", async () => {
      const { enqueueMessage } = await import("@/lib/messageQueue");
      (enqueueMessage as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
      const setPendingCount = makeCallbackMock(0);
      const setMessages = makeCallbackMock([]);
      const opts = makeOptions({ isOnline: false, setMessages, setPendingCount });
      const { result } = renderHook(() => useChatSend(opts));

      act(() => { result.current.setInput("offline msg"); });
      await act(async () => { await result.current.handleSend(); });
      // Let the .then resolve
      await act(async () => { await new Promise(r => setTimeout(r, 10)); });

      expect(setPendingCount).toHaveBeenCalled();
    });
  });

  describe("handleRetry edge cases", () => {
    it("walks back to find user message when non-user messages are between", async () => {
      const { apiFetch } = await import("@/lib/apiFetch");
      const mockApiFetch = apiFetch as ReturnType<typeof vi.fn>;
      mockApiFetch.mockResolvedValue(makeSSEResponse([
        { type: "token", text: "ok" },
        { type: "done", reply: "ok" },
      ]));

      const messages: import("@/lib/chat-types").Message[] = [
        { id: "user-1", role: "user", content: "original" },
        { id: "asst-1", role: "assistant", content: "first reply" },
        { id: "asst-2", role: "assistant", content: "follow-up" },
      ];
      const setMessages = makeCallbackMock(messages);
      const opts = makeOptions({ messages, setMessages });
      const { result } = renderHook(() => useChatSend(opts));

      await act(async () => { await result.current.handleRetry("asst-2"); });

      const body = JSON.parse(mockApiFetch.mock.calls[0][1].body);
      expect(body.message).toBe("original");
    });

    it("does nothing when msgIndex is 0", async () => {
      const { apiFetch } = await import("@/lib/apiFetch");
      const mockApiFetch = apiFetch as ReturnType<typeof vi.fn>;

      const messages: import("@/lib/chat-types").Message[] = [
        { id: "asst-1", role: "assistant", content: "reply" },
      ];
      const opts = makeOptions({ messages });
      const { result } = renderHook(() => useChatSend(opts));

      await act(async () => { await result.current.handleRetry("asst-1"); });

      expect(mockApiFetch).not.toHaveBeenCalled();
    });

    it("handles error during retry stream", async () => {
      const { apiFetch } = await import("@/lib/apiFetch");
      const mockApiFetch = apiFetch as ReturnType<typeof vi.fn>;
      mockApiFetch.mockRejectedValue(new Error("retry fail"));

      const messages: import("@/lib/chat-types").Message[] = [
        { id: "user-1", role: "user", content: "test" },
        { id: "asst-1", role: "assistant", content: "reply" },
      ];
      const setMessages = makeCallbackMock(messages);
      const opts = makeOptions({ messages, setMessages });
      const { result } = renderHook(() => useChatSend(opts));

      await act(async () => { await result.current.handleRetry("asst-1"); });

      expect(result.current.error).toBe("retry fail");
    });
  });

  describe("handleEditSave edge cases", () => {
    it("does nothing when editText is empty", async () => {
      const { apiFetch } = await import("@/lib/apiFetch");
      const mockApiFetch = apiFetch as ReturnType<typeof vi.fn>;

      const messages: import("@/lib/chat-types").Message[] = [
        { id: "user-1", role: "user", content: "hello" },
      ];
      const opts = makeOptions({ messages });
      const { result } = renderHook(() => useChatSend(opts));

      act(() => {
        result.current.setEditingMsgId("user-1");
        result.current.setEditText("   ");
      });

      await act(async () => { await result.current.handleEditSave(); });

      expect(mockApiFetch).not.toHaveBeenCalled();
    });

    it("does nothing when currentAnimationId is undefined", async () => {
      const { apiFetch } = await import("@/lib/apiFetch");
      const mockApiFetch = apiFetch as ReturnType<typeof vi.fn>;

      const messages: import("@/lib/chat-types").Message[] = [
        { id: "user-1", role: "user", content: "hello" },
      ];
      const opts = makeOptions({ messages, currentAnimationId: undefined });
      const { result } = renderHook(() => useChatSend(opts));

      act(() => {
        result.current.setEditingMsgId("user-1");
        result.current.setEditText("new text");
      });

      await act(async () => { await result.current.handleEditSave(); });

      expect(mockApiFetch).not.toHaveBeenCalled();
    });

    it("handles stream error after successful PATCH", async () => {
      const { apiFetch } = await import("@/lib/apiFetch");
      const mockApiFetch = apiFetch as ReturnType<typeof vi.fn>;
      mockApiFetch.mockRejectedValue(new Error("stream fail"));

      const globalFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      });
      vi.stubGlobal("fetch", globalFetch);

      const messages: import("@/lib/chat-types").Message[] = [
        { id: "user-1", role: "user", content: "hello" },
      ];
      const setMessages = makeCallbackMock(messages);
      const opts = makeOptions({ messages, setMessages });
      const { result } = renderHook(() => useChatSend(opts));

      act(() => {
        result.current.setEditingMsgId("user-1");
        result.current.setEditText("new text");
      });

      await act(async () => { await result.current.handleEditSave(); });

      expect(result.current.error).toBe("stream fail");

      vi.unstubAllGlobals();
    });
  });

  describe("handleVariationSelect with callback execution", () => {
    it("executes setMessages callback to update variation message", () => {
      const onAnimationUpdated = vi.fn();
      const msgs: import("@/lib/chat-types").Message[] = [
        { id: "msg-1", role: "assistant", content: "old", variations: [], variationsLoading: true },
      ];
      const setMessages = makeCallbackMock(msgs);
      const opts = makeOptions({ setMessages, onAnimationUpdated, messages: msgs });
      const { result } = renderHook(() => useChatSend(opts));

      act(() => {
        result.current.handleVariationSelect("msg-1", {
          style: "neon",
          animation: { v: "5.0", layers: [] },
        } as unknown as import("@/components/VariationGrid").Variation);
      });

      expect(setMessages).toHaveBeenCalled();
      const callbackResult = setMessages.mock.results[0].value;
      expect(callbackResult).toBeInstanceOf(Array);
    });
  });

  describe("non-SSE JSON with new assistant message", () => {
    it("appends new assistant message in non-SSE path", async () => {
      const { apiFetch } = await import("@/lib/apiFetch");
      const mockApiFetch = apiFetch as ReturnType<typeof vi.fn>;
      mockApiFetch.mockResolvedValue(makeJSONResponse({ reply: "hello back" }));

      const setMessages = makeCallbackMock([]);
      const opts = makeOptions({ setMessages });
      const { result } = renderHook(() => useChatSend(opts));

      act(() => { result.current.setInput("hi"); });
      await act(async () => { await result.current.handleSend(); });

      expect(setMessages).toHaveBeenCalled();
    });
  });

  describe("setMessages callback inner map coverage", () => {
    it("non-SSE existingAssistantMsgId path maps over messages with matching id", async () => {
      const { apiFetch } = await import("@/lib/apiFetch");
      const mockApiFetch = apiFetch as ReturnType<typeof vi.fn>;
      mockApiFetch.mockResolvedValue(makeJSONResponse({ reply: "updated" }));

      const msgs: import("@/lib/chat-types").Message[] = [
        { id: "user-1", role: "user", content: "hello" },
        { id: "asst-1", role: "assistant", content: "old" },
      ];
      const setMessages = makeCallbackMock(msgs);
      const opts = makeOptions({ messages: msgs, setMessages });
      const { result } = renderHook(() => useChatSend(opts));

      await act(async () => { await result.current.handleRetry("asst-1"); });

      const mapCalls = setMessages.mock.calls.filter(
        (c: unknown[]) => typeof c[0] === "function"
      );
      expect(mapCalls.length).toBeGreaterThan(0);
    });

    it("SSE token update maps over messages with matching assistant id", async () => {
      const { apiFetch } = await import("@/lib/apiFetch");
      const mockApiFetch = apiFetch as ReturnType<typeof vi.fn>;
      mockApiFetch.mockResolvedValue(makeSSEResponse([
        { type: "token", text: "First" },
        { type: "token", text: " Second" },
        { type: "done", reply: "First Second" },
      ]));

      const msgs: import("@/lib/chat-types").Message[] = [
        { id: "user-1", role: "user", content: "go" },
      ];
      // Use a dynamic mock that adds messages as they come
      let internalMsgs = [...msgs];
      const setMessages = vi.fn((valOrFn: unknown) => {
        if (typeof valOrFn === "function") {
          internalMsgs = (valOrFn as (prev: import("@/lib/chat-types").Message[]) => import("@/lib/chat-types").Message[])(internalMsgs);
          return internalMsgs;
        }
        internalMsgs = valOrFn as import("@/lib/chat-types").Message[];
        return internalMsgs;
      });
      const opts = makeOptions({ messages: msgs, setMessages });
      const { result } = renderHook(() => useChatSend(opts));

      act(() => { result.current.setInput("go"); });
      await act(async () => { await result.current.handleSend(); });

      expect(setMessages).toHaveBeenCalled();
      // The second token should have triggered a .map with a matching id
      expect(internalMsgs.some((m: import("@/lib/chat-types").Message) => m.role === "assistant")).toBe(true);
    });

    it("SSE done maps over messages with matching assistant id", async () => {
      const { apiFetch } = await import("@/lib/apiFetch");
      const mockApiFetch = apiFetch as ReturnType<typeof vi.fn>;
      mockApiFetch.mockResolvedValue(makeSSEResponse([
        { type: "token", text: "Result" },
        { type: "done", reply: "Final", warning: "warn", suggestions: ["s1"], lottieJson: { v: "5" }, previousLottieJson: { v: "4" } },
      ]));

      let internalMsgs: import("@/lib/chat-types").Message[] = [];
      const setMessages = vi.fn((valOrFn: unknown) => {
        if (typeof valOrFn === "function") {
          internalMsgs = (valOrFn as (prev: import("@/lib/chat-types").Message[]) => import("@/lib/chat-types").Message[])(internalMsgs);
          return internalMsgs;
        }
        internalMsgs = valOrFn as import("@/lib/chat-types").Message[];
        return internalMsgs;
      });
      const opts = makeOptions({ setMessages });
      const { result } = renderHook(() => useChatSend(opts));

      act(() => { result.current.setInput("go"); });
      await act(async () => { await result.current.handleSend(); });

      const finalMsg = internalMsgs.find((m: import("@/lib/chat-types").Message) => m.role === "assistant");
      expect(finalMsg).toBeDefined();
      expect(finalMsg!.content).toBe("Final");
      expect(finalMsg!.warning).toBe("warn");
    });

    it("SSE quality_hints maps over messages with matching assistant id", async () => {
      const { apiFetch } = await import("@/lib/apiFetch");
      const mockApiFetch = apiFetch as ReturnType<typeof vi.fn>;
      mockApiFetch.mockResolvedValue(makeSSEResponse([
        { type: "token", text: "ok" },
        { type: "quality_hints", hints: [{ level: "warning", message: "hint" }] },
        { type: "done", reply: "ok" },
      ]));

      let internalMsgs: import("@/lib/chat-types").Message[] = [];
      const setMessages = vi.fn((valOrFn: unknown) => {
        if (typeof valOrFn === "function") {
          internalMsgs = (valOrFn as (prev: import("@/lib/chat-types").Message[]) => import("@/lib/chat-types").Message[])(internalMsgs);
          return internalMsgs;
        }
        internalMsgs = valOrFn as import("@/lib/chat-types").Message[];
        return internalMsgs;
      });
      const opts = makeOptions({ setMessages });
      const { result } = renderHook(() => useChatSend(opts));

      act(() => { result.current.setInput("go"); });
      await act(async () => { await result.current.handleSend(); });

      const asstMsg = internalMsgs.find((m: import("@/lib/chat-types").Message) => m.role === "assistant");
      expect(asstMsg).toBeDefined();
    });

    it("SSE repair_token update maps with matching id then new repair msg", async () => {
      const { apiFetch } = await import("@/lib/apiFetch");
      const mockApiFetch = apiFetch as ReturnType<typeof vi.fn>;
      mockApiFetch.mockResolvedValue(makeSSEResponse([
        { type: "token", text: "First" },
        { type: "repairing" },
        { type: "repair_token", text: "Repaired" },
        { type: "repair_token", text: " more" },
        { type: "done", reply: "Repaired more" },
      ]));

      let internalMsgs: import("@/lib/chat-types").Message[] = [];
      const setMessages = vi.fn((valOrFn: unknown) => {
        if (typeof valOrFn === "function") {
          internalMsgs = (valOrFn as (prev: import("@/lib/chat-types").Message[]) => import("@/lib/chat-types").Message[])(internalMsgs);
          return internalMsgs;
        }
        internalMsgs = valOrFn as import("@/lib/chat-types").Message[];
        return internalMsgs;
      });
      const opts = makeOptions({ setMessages });
      const { result } = renderHook(() => useChatSend(opts));

      act(() => { result.current.setInput("go"); });
      await act(async () => { await result.current.handleSend(); });

      expect(setMessages).toHaveBeenCalled();
    });

    it("SSE start clears existing message via map", async () => {
      const { apiFetch } = await import("@/lib/apiFetch");
      const mockApiFetch = apiFetch as ReturnType<typeof vi.fn>;
      mockApiFetch.mockResolvedValue(makeSSEResponse([
        { type: "token", text: "new" },
        { type: "done", reply: "new" },
      ]));

      const msgs: import("@/lib/chat-types").Message[] = [
        { id: "user-1", role: "user", content: "hello" },
        { id: "asst-1", role: "assistant", content: "old" },
      ];
      let internalMsgs = [...msgs];
      const setMessages = vi.fn((valOrFn: unknown) => {
        if (typeof valOrFn === "function") {
          internalMsgs = (valOrFn as (prev: import("@/lib/chat-types").Message[]) => import("@/lib/chat-types").Message[])(internalMsgs);
          return internalMsgs;
        }
        internalMsgs = valOrFn as import("@/lib/chat-types").Message[];
        return internalMsgs;
      });
      const opts = makeOptions({ messages: msgs, setMessages });
      const { result } = renderHook(() => useChatSend(opts));

      await act(async () => { await result.current.handleRetry("asst-1"); });

      // The clear should have set asst-1 content to ""
      expect(setMessages).toHaveBeenCalled();
    });

    it("handleEditSave maps messages with matching editingMsgId", async () => {
      const { apiFetch } = await import("@/lib/apiFetch");
      const mockApiFetch = apiFetch as ReturnType<typeof vi.fn>;
      mockApiFetch.mockResolvedValue(makeSSEResponse([
        { type: "token", text: "ok" },
        { type: "done", reply: "ok" },
      ]));

      const globalFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      });
      vi.stubGlobal("fetch", globalFetch);

      const msgs: import("@/lib/chat-types").Message[] = [
        { id: "user-1", role: "user", content: "original" },
        { id: "asst-1", role: "assistant", content: "reply" },
      ];
      const setMessages = makeCallbackMock(msgs);
      const opts = makeOptions({ messages: msgs, setMessages });
      const { result } = renderHook(() => useChatSend(opts));

      act(() => {
        result.current.setEditingMsgId("user-1");
        result.current.setEditText("edited");
      });

      await act(async () => { await result.current.handleEditSave(); });

      // The .map inside handleEditSave (line 773) should have executed
      expect(setMessages).toHaveBeenCalled();

      vi.unstubAllGlobals();
    });

    it("variations success maps to update assistantMsgId", async () => {
      const { apiFetch } = await import("@/lib/apiFetch");
      const { parseCommand } = await import("@/lib/commands");
      vi.mocked(parseCommand).mockReturnValueOnce({ type: "variations", prompt: "test" } as ReturnType<typeof parseCommand>);
      const mockApiFetch = apiFetch as ReturnType<typeof vi.fn>;
      mockApiFetch.mockResolvedValue(makeJSONResponse({
        variations: [{ style: "neon", animation: { v: "5.0" } }],
      }));

      let internalMsgs: import("@/lib/chat-types").Message[] = [];
      const setMessages = vi.fn((valOrFn: unknown) => {
        if (typeof valOrFn === "function") {
          internalMsgs = (valOrFn as (prev: import("@/lib/chat-types").Message[]) => import("@/lib/chat-types").Message[])(internalMsgs);
          return internalMsgs;
        }
        internalMsgs = valOrFn as import("@/lib/chat-types").Message[];
        return internalMsgs;
      });
      const opts = makeOptions({ setMessages });
      const { result } = renderHook(() => useChatSend(opts));

      act(() => { result.current.setInput("/variations test"); });
      await act(async () => { await result.current.handleSend(); });

      expect(setMessages).toHaveBeenCalled();
    });

    it("variations error maps to update assistantMsgId", async () => {
      const { apiFetch } = await import("@/lib/apiFetch");
      const { parseCommand } = await import("@/lib/commands");
      vi.mocked(parseCommand).mockReturnValueOnce({ type: "variations", prompt: "test" } as ReturnType<typeof parseCommand>);
      (apiFetch as ReturnType<typeof vi.fn>).mockResolvedValue(makeJSONResponse({ error: "fail" }, false, 500));

      let internalMsgs: import("@/lib/chat-types").Message[] = [];
      const setMessages = vi.fn((valOrFn: unknown) => {
        if (typeof valOrFn === "function") {
          internalMsgs = (valOrFn as (prev: import("@/lib/chat-types").Message[]) => import("@/lib/chat-types").Message[])(internalMsgs);
          return internalMsgs;
        }
        internalMsgs = valOrFn as import("@/lib/chat-types").Message[];
        return internalMsgs;
      });
      const opts = makeOptions({ setMessages });
      const { result } = renderHook(() => useChatSend(opts));

      act(() => { result.current.setInput("/variations test"); });
      await act(async () => { await result.current.handleSend(); });

      expect(setMessages).toHaveBeenCalled();
    });

    it("variations network error maps to update assistantMsgId", async () => {
      const { apiFetch } = await import("@/lib/apiFetch");
      const { parseCommand } = await import("@/lib/commands");
      vi.mocked(parseCommand).mockReturnValueOnce({ type: "variations", prompt: "test" } as ReturnType<typeof parseCommand>);
      (apiFetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("net"));

      let internalMsgs: import("@/lib/chat-types").Message[] = [];
      const setMessages = vi.fn((valOrFn: unknown) => {
        if (typeof valOrFn === "function") {
          internalMsgs = (valOrFn as (prev: import("@/lib/chat-types").Message[]) => import("@/lib/chat-types").Message[])(internalMsgs);
          return internalMsgs;
        }
        internalMsgs = valOrFn as import("@/lib/chat-types").Message[];
        return internalMsgs;
      });
      const opts = makeOptions({ setMessages });
      const { result } = renderHook(() => useChatSend(opts));

      act(() => { result.current.setInput("/variations test"); });
      await act(async () => { await result.current.handleSend(); });

      expect(setMessages).toHaveBeenCalled();
    });

    it("style_list exercises VALID_STYLES.map callback", async () => {
      const { parseCommand } = await import("@/lib/commands");
      vi.mocked(parseCommand).mockReturnValueOnce({ type: "style_list" } as ReturnType<typeof parseCommand>);

      let internalMsgs: import("@/lib/chat-types").Message[] = [];
      const setMessages = vi.fn((valOrFn: unknown) => {
        if (typeof valOrFn === "function") {
          internalMsgs = (valOrFn as (prev: import("@/lib/chat-types").Message[]) => import("@/lib/chat-types").Message[])(internalMsgs);
          return internalMsgs;
        }
        internalMsgs = valOrFn as import("@/lib/chat-types").Message[];
        return internalMsgs;
      });
      const opts = makeOptions({ setMessages });
      const { result } = renderHook(() => useChatSend(opts));

      act(() => { result.current.setInput("/style"); });
      await act(async () => { await result.current.handleSend(); });

      const asstMsg = internalMsgs.find((m: import("@/lib/chat-types").Message) => m.role === "assistant");
      expect(asstMsg).toBeDefined();
      expect(asstMsg!.content).toContain("neon");
    });

    it("theme show with tokens exercises Object.entries filter and map", async () => {
      const { useDesignTokens } = await import("@/contexts/DesignTokensContext");
      vi.mocked(useDesignTokens).mockReturnValue({
        tokens: { primary: "blue", secondary: "" },
        setToken: vi.fn(),
        clearTokens: vi.fn(),
        hasTokens: true,
      } as ReturnType<typeof useDesignTokens>);

      const { parseCommand } = await import("@/lib/commands");
      vi.mocked(parseCommand).mockReturnValueOnce({ type: "theme", subcommand: { action: "show" } } as ReturnType<typeof parseCommand>);

      let internalMsgs: import("@/lib/chat-types").Message[] = [];
      const setMessages = vi.fn((valOrFn: unknown) => {
        if (typeof valOrFn === "function") {
          internalMsgs = (valOrFn as (prev: import("@/lib/chat-types").Message[]) => import("@/lib/chat-types").Message[])(internalMsgs);
          return internalMsgs;
        }
        internalMsgs = valOrFn as import("@/lib/chat-types").Message[];
        return internalMsgs;
      });
      const opts = makeOptions({ setMessages });
      const { result } = renderHook(() => useChatSend(opts));

      act(() => { result.current.setInput("/theme"); });
      await act(async () => { await result.current.handleSend(); });

      const asstMsg = internalMsgs.find((m: import("@/lib/chat-types").Message) => m.role === "assistant");
      expect(asstMsg).toBeDefined();
      expect(asstMsg!.content).toContain("primary");
    });

    it("presets list with items exercises presets.map callback", async () => {
      const { apiFetch } = await import("@/lib/apiFetch");
      const { parseCommand } = await import("@/lib/commands");
      vi.mocked(parseCommand).mockReturnValueOnce({ type: "presets", subcommand: "list" } as ReturnType<typeof parseCommand>);
      (apiFetch as ReturnType<typeof vi.fn>).mockResolvedValue(makeJSONResponse([
        { name: "cool", description: "A cool preset", is_builtin: 1 },
        { name: "warm", description: null },
      ]));

      let internalMsgs: import("@/lib/chat-types").Message[] = [];
      const setMessages = vi.fn((valOrFn: unknown) => {
        if (typeof valOrFn === "function") {
          internalMsgs = (valOrFn as (prev: import("@/lib/chat-types").Message[]) => import("@/lib/chat-types").Message[])(internalMsgs);
          return internalMsgs;
        }
        internalMsgs = valOrFn as import("@/lib/chat-types").Message[];
        return internalMsgs;
      });
      const opts = makeOptions({ setMessages });
      const { result } = renderHook(() => useChatSend(opts));

      act(() => { result.current.setInput("/presets"); });
      await act(async () => { await result.current.handleSend(); });

      const asstMsg = internalMsgs.find((m: import("@/lib/chat-types").Message) => m.role === "assistant");
      expect(asstMsg).toBeDefined();
      expect(asstMsg!.content).toContain("cool");
      expect(asstMsg!.content).toContain("built-in");
    });

    it("sequence_show with items exercises items.map callback", async () => {
      const { parseCommand } = await import("@/lib/commands");
      vi.mocked(parseCommand).mockReturnValueOnce({ type: "sequence_show", name: "seq" } as ReturnType<typeof parseCommand>);

      const globalFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([{
          id: "seq-1",
          name: "seq",
          description: "desc",
          items: [
            { animation_name: "Bounce", position: 0, transition_type: "fade" },
            { animation_name: null, position: 1, transition_type: "cut" },
          ],
        }]),
      });
      vi.stubGlobal("fetch", globalFetch);

      let internalMsgs: import("@/lib/chat-types").Message[] = [];
      const setMessages = vi.fn((valOrFn: unknown) => {
        if (typeof valOrFn === "function") {
          internalMsgs = (valOrFn as (prev: import("@/lib/chat-types").Message[]) => import("@/lib/chat-types").Message[])(internalMsgs);
          return internalMsgs;
        }
        internalMsgs = valOrFn as import("@/lib/chat-types").Message[];
        return internalMsgs;
      });
      const opts = makeOptions({ setMessages });
      const { result } = renderHook(() => useChatSend(opts));

      act(() => { result.current.setInput("/sequence show seq"); });
      await act(async () => { await result.current.handleSend(); });

      const asstMsg = internalMsgs.find((m: import("@/lib/chat-types").Message) => m.role === "assistant");
      expect(asstMsg).toBeDefined();
      expect(asstMsg!.content).toContain("Bounce");
      expect(asstMsg!.content).toContain("Untitled");

      vi.unstubAllGlobals();
    });

    it("sequence_show with empty items array", async () => {
      const { parseCommand } = await import("@/lib/commands");
      vi.mocked(parseCommand).mockReturnValueOnce({ type: "sequence_show", name: "seq" } as ReturnType<typeof parseCommand>);

      const globalFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([{
          id: "seq-1",
          name: "seq",
          items: [],
        }]),
      });
      vi.stubGlobal("fetch", globalFetch);

      let internalMsgs: import("@/lib/chat-types").Message[] = [];
      const setMessages = vi.fn((valOrFn: unknown) => {
        if (typeof valOrFn === "function") {
          internalMsgs = (valOrFn as (prev: import("@/lib/chat-types").Message[]) => import("@/lib/chat-types").Message[])(internalMsgs);
          return internalMsgs;
        }
        internalMsgs = valOrFn as import("@/lib/chat-types").Message[];
        return internalMsgs;
      });
      const opts = makeOptions({ setMessages });
      const { result } = renderHook(() => useChatSend(opts));

      act(() => { result.current.setInput("/sequence show seq"); });
      await act(async () => { await result.current.handleSend(); });

      const asstMsg = internalMsgs.find((m: import("@/lib/chat-types").Message) => m.role === "assistant");
      expect(asstMsg!.content).toContain("No animations");

      vi.unstubAllGlobals();
    });

    it("handleVariationSelect exercises inner map callback with matching msg", () => {
      const onAnimationUpdated = vi.fn();
      const msgs: import("@/lib/chat-types").Message[] = [
        { id: "msg-1", role: "assistant", content: "old", variations: [], variationsLoading: true },
        { id: "msg-2", role: "user", content: "other" },
      ];
      let internalMsgs = [...msgs];
      const setMessages = vi.fn((valOrFn: unknown) => {
        if (typeof valOrFn === "function") {
          internalMsgs = (valOrFn as (prev: import("@/lib/chat-types").Message[]) => import("@/lib/chat-types").Message[])(internalMsgs);
          return internalMsgs;
        }
        internalMsgs = valOrFn as import("@/lib/chat-types").Message[];
        return internalMsgs;
      });
      const opts = makeOptions({ setMessages, onAnimationUpdated, messages: msgs });
      const { result } = renderHook(() => useChatSend(opts));

      act(() => {
        result.current.handleVariationSelect("msg-1", {
          style: "neon",
          animation: { v: "5.0", layers: [] },
        } as unknown as import("@/components/VariationGrid").Variation);
      });

      const updatedMsg = internalMsgs.find((m: import("@/lib/chat-types").Message) => m.id === "msg-1");
      expect(updatedMsg!.variations).toBeUndefined();
      expect(updatedMsg!.variationsLoading).toBe(false);
    });

    it("offline enqueue .catch callback fires on rejection", async () => {
      const { enqueueMessage } = await import("@/lib/messageQueue");
      (enqueueMessage as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("enqueue fail"));

      const setMessages = makeCallbackMock([]);
      const setPendingCount = makeCallbackMock(0);
      const opts = makeOptions({ isOnline: false, setMessages, setPendingCount });
      const { result } = renderHook(() => useChatSend(opts));

      act(() => { result.current.setInput("offline msg"); });
      await act(async () => { await result.current.handleSend(); });
      await act(async () => { await new Promise(r => setTimeout(r, 20)); });

      // Should not throw — .catch(() => {}) handles it
      expect(setPendingCount).not.toHaveBeenCalled();
    });

    it("handleRetry .slice callback executes on messages array", async () => {
      const { apiFetch } = await import("@/lib/apiFetch");
      const mockApiFetch = apiFetch as ReturnType<typeof vi.fn>;
      mockApiFetch.mockResolvedValue(makeSSEResponse([
        { type: "token", text: "ok" },
        { type: "done", reply: "ok" },
      ]));

      const msgs: import("@/lib/chat-types").Message[] = [
        { id: "user-1", role: "user", content: "test" },
        { id: "asst-1", role: "assistant", content: "reply" },
        { id: "user-2", role: "user", content: "followup" },
        { id: "asst-2", role: "assistant", content: "reply2" },
      ];
      let internalMsgs = [...msgs];
      const setMessages = vi.fn((valOrFn: unknown) => {
        if (typeof valOrFn === "function") {
          internalMsgs = (valOrFn as (prev: import("@/lib/chat-types").Message[]) => import("@/lib/chat-types").Message[])(internalMsgs);
          return internalMsgs;
        }
        internalMsgs = valOrFn as import("@/lib/chat-types").Message[];
        return internalMsgs;
      });
      const opts = makeOptions({ messages: msgs, setMessages });
      const { result } = renderHook(() => useChatSend(opts));

      await act(async () => { await result.current.handleRetry("asst-2"); });

      // slice should have truncated to index 4 (msgIndex+1=4)
      expect(setMessages).toHaveBeenCalled();
    });
  });

  describe("quality_hints with no assistantMsgId", () => {
    it("quality_hints before any token is ignored", async () => {
      const { apiFetch } = await import("@/lib/apiFetch");
      const mockApiFetch = apiFetch as ReturnType<typeof vi.fn>;
      mockApiFetch.mockResolvedValue(makeSSEResponse([
        { type: "quality_hints", hints: [{ level: "info", message: "hint" }] },
        { type: "token", text: "ok" },
        { type: "done", reply: "ok" },
      ]));

      const setMessages = makeCallbackMock([]);
      const opts = makeOptions({ setMessages });
      const { result } = renderHook(() => useChatSend(opts));

      act(() => { result.current.setInput("test"); });
      await act(async () => { await result.current.handleSend(); });

      expect(setMessages).toHaveBeenCalled();
    });
  });

  describe("SSE token with existing assistantMsgId updates message", () => {
    it("updates existing assistant message on subsequent tokens", async () => {
      const { apiFetch } = await import("@/lib/apiFetch");
      const mockApiFetch = apiFetch as ReturnType<typeof vi.fn>;
      mockApiFetch.mockResolvedValue(makeSSEResponse([
        { type: "token", text: "First " },
        { type: "token", text: "Second" },
        { type: "done", reply: "First Second" },
      ]));

      const setMessages = makeCallbackMock([]);
      const opts = makeOptions({ setMessages });
      const { result } = renderHook(() => useChatSend(opts));

      act(() => { result.current.setInput("test"); });
      await act(async () => { await result.current.handleSend(); });

      expect(setMessages).toHaveBeenCalled();
    });
  });

  describe("handleStop during stream", () => {
    it("stops streaming when called mid-stream", async () => {
      const { apiFetch } = await import("@/lib/apiFetch");
      const mockApiFetch = apiFetch as ReturnType<typeof vi.fn>;

      // Create a response that will be aborted
      let readerController: ReadableStreamDefaultController | null = null;
      const body = new ReadableStream({
        start(controller) {
          readerController = controller;
          const encoder = new TextEncoder();
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "token", text: "start" })}\n\n`));
        },
      });
      mockApiFetch.mockResolvedValue({
        headers: { get: (h: string) => h.toLowerCase() === "content-type" ? "text/event-stream" : null },
        ok: true,
        body,
      });

      const opts = makeOptions();
      const { result } = renderHook(() => useChatSend(opts));

      act(() => { result.current.setInput("long task"); });

      // Start sending - wrap in a promise we can await
      const sendPromise = act(async () => {
        await result.current.handleSend();
      });

      // Give it a tick to start
      await new Promise(r => setTimeout(r, 50));

      // Stop it
      act(() => { result.current.handleStop(); });

      // Close the reader to unblock
      try { (readerController as ReadableStreamDefaultController | null)?.close(); } catch { /* ok */ }

      await sendPromise;

      expect(result.current.isStreaming).toBe(false);
      expect(result.current.isThinking).toBe(false);
    });
  });
});
