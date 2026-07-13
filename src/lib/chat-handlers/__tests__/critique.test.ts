import { describe, it, expect, vi, beforeEach } from "vitest";

const dbRunMock = vi.fn();
const dbGetMock = vi.fn();
const dbPrepareMock = vi.fn(() => ({ run: dbRunMock, get: dbGetMock }));

vi.mock("@/lib/db", () => ({
  db: { prepare: dbPrepareMock },
  ANIMATIONS_DIR: "/tmp/test-animations",
}));

vi.mock("@/lib/events", () => ({
  animationEvents: { emit: vi.fn() },
}));

vi.mock("node:fs", () => ({
  default: { existsSync: vi.fn(() => true), readFileSync: vi.fn(), writeFileSync: vi.fn() },
  writeFileSync: vi.fn(),
}));

const chatCompletionStreamMock = vi.fn();

vi.mock("@/lib/llm", () => ({
  chatCompletionStream: chatCompletionStreamMock,
  parseResponse: vi.fn(),
}));

function mockStreamResponse(chunks: string[]): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    },
  });
  return new Response(stream);
}

describe("chat-handlers/critique", () => {
  let handleCritique: typeof import("../critique").handleCritique;
  let fs: { default: { existsSync: ReturnType<typeof vi.fn>; readFileSync: ReturnType<typeof vi.fn> } };

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import("../critique");
    handleCritique = mod.handleCritique;
    fs = await import("node:fs") as any;
  });

  it("returns 'create animation first' when no animationId", async () => {
    const resp = await handleCritique(undefined, "critique this");
    const text = await resp.text();
    const data = JSON.parse(text.replace("data: ", "").trim());
    expect(data.reply).toContain("Create an animation first");
  });

  it("returns 404 when animation not found", async () => {
    dbGetMock.mockReturnValueOnce(undefined);
    const resp = await handleCritique("anim1", "critique this");
    expect(resp.status).toBe(404);
    const json = await resp.json();
    expect(json.error).toContain("not found");
  });

  it("returns 'create animation first' when no JSON file exists", async () => {
    dbGetMock.mockReturnValueOnce({ id: "anim1" });
    fs.default.existsSync.mockReturnValueOnce(false);
    const resp = await handleCritique("anim1", "critique this");
    const text = await resp.text();
    const data = JSON.parse(text.replace("data: ", "").trim());
    expect(data.reply).toContain("Create an animation first");
  });

  it("returns 502 when LLM request fails", async () => {
    dbGetMock.mockReturnValueOnce({ id: "anim1" });
    fs.default.existsSync.mockReturnValueOnce(true);
    fs.default.readFileSync.mockReturnValueOnce('{"v":"5.7.1"}');
    chatCompletionStreamMock.mockRejectedValueOnce(new Error("LLM down"));
    const resp = await handleCritique("anim1", "critique this");
    expect(resp.status).toBe(502);
    const json = await resp.json();
    expect(json.error).toContain("LLM request failed");
  });

  it("returns 502 when LLM returns no body", async () => {
    dbGetMock.mockReturnValueOnce({ id: "anim1" });
    fs.default.existsSync.mockReturnValueOnce(true);
    fs.default.readFileSync.mockReturnValueOnce('{"v":"5.7.1"}');
    chatCompletionStreamMock.mockResolvedValueOnce(new Response(null));
    const resp = await handleCritique("anim1", "critique this");
    expect(resp.status).toBe(502);
    const json = await resp.json();
    expect(json.error).toContain("no body");
  });

  it("streams critique tokens and saves to DB on success", async () => {
    dbGetMock.mockReturnValueOnce({ id: "anim1" });
    fs.default.existsSync.mockReturnValueOnce(true);
    fs.default.readFileSync.mockReturnValueOnce('{"v":"5.7.1"}');

    const chunks = [
      'data: {"choices":[{"delta":{"content":"Great "}}]}\n\n',
      'data: {"choices":[{"delta":{"content":"animation!"}}]}\n\n',
      "data: [DONE]\n\n",
    ];
    chatCompletionStreamMock.mockResolvedValueOnce(mockStreamResponse(chunks));

    const resp = await handleCritique("anim1", "critique this");
    const text = await resp.text();
    const lines = text.split("\n").filter((l: string) => l.startsWith("data: "));

    const tokenEvents = lines
      .map((l: string) => JSON.parse(l.slice(6)))
      .filter((e: any) => e.type === "token");
    expect(tokenEvents).toHaveLength(2);
    expect(tokenEvents[0].text).toBe("Great ");
    expect(tokenEvents[1].text).toBe("animation!");

    const doneEvent = lines
      .map((l: string) => JSON.parse(l.slice(6)))
      .find((e: any) => e.type === "done");
    expect(doneEvent.reply).toBe("Great animation!");
    expect(doneEvent.animationId).toBe("anim1");

    // user message + assistant message saved
    expect(dbPrepareMock).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO messages")
    );
  });
});
