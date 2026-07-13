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
const parseResponseMock = vi.fn();

vi.mock("@/lib/llm", () => ({
  chatCompletionStream: chatCompletionStreamMock,
  parseResponse: parseResponseMock,
}));

vi.mock("@/lib/optimizer", () => ({
  roundDecimals: vi.fn((json: any) => json),
  removeEmptyGroups: vi.fn((json: any) => json),
  removeHiddenLayers: vi.fn((json: any) => json),
  validateAndFix: vi.fn((json: any) => ({ fixed: json, errors: [] })),
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

describe("chat-handlers/polish", () => {
  let handlePolish: typeof import("../polish").handlePolish;
  let fs: { default: { existsSync: ReturnType<typeof vi.fn>; readFileSync: ReturnType<typeof vi.fn>; writeFileSync: ReturnType<typeof vi.fn> } };

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import("../polish");
    handlePolish = mod.handlePolish;
    fs = await import("node:fs") as any;
  });

  it("returns 'create animation first' when no animationId", async () => {
    const resp = await handlePolish(undefined, "polish this");
    const text = await resp.text();
    const data = JSON.parse(text.replace("data: ", "").trim());
    expect(data.reply).toContain("Create an animation first");
  });

  it("returns 404 when animation not found", async () => {
    dbGetMock.mockReturnValueOnce(undefined);
    const resp = await handlePolish("anim1", "polish this");
    expect(resp.status).toBe(404);
    const json = await resp.json();
    expect(json.error).toContain("not found");
  });

  it("returns 'create animation first' when no JSON file exists", async () => {
    dbGetMock.mockReturnValueOnce({ id: "anim1" });
    fs.default.existsSync.mockReturnValueOnce(false);
    const resp = await handlePolish("anim1", "polish this");
    const text = await resp.text();
    const data = JSON.parse(text.replace("data: ", "").trim());
    expect(data.reply).toContain("Create an animation first");
  });

  it("returns 502 when LLM request fails", async () => {
    dbGetMock.mockReturnValueOnce({ id: "anim1" });
    fs.default.existsSync.mockReturnValueOnce(true);
    fs.default.readFileSync.mockReturnValueOnce('{"v":"5.7.1"}');
    chatCompletionStreamMock.mockRejectedValueOnce(new Error("LLM down"));
    const resp = await handlePolish("anim1", "polish this");
    expect(resp.status).toBe(502);
    const json = await resp.json();
    expect(json.error).toContain("LLM request failed");
  });

  it("returns 502 when LLM returns no body", async () => {
    dbGetMock.mockReturnValueOnce({ id: "anim1" });
    fs.default.existsSync.mockReturnValueOnce(true);
    fs.default.readFileSync.mockReturnValueOnce('{"v":"5.7.1"}');
    chatCompletionStreamMock.mockResolvedValueOnce(new Response(null));
    const resp = await handlePolish("anim1", "polish this");
    expect(resp.status).toBe(502);
    const json = await resp.json();
    expect(json.error).toContain("no body");
  });

  it("streams polish response, parses JSON, saves version and writes file on success", async () => {
    dbGetMock.mockReturnValueOnce({ id: "anim1" });
    fs.default.existsSync.mockReturnValueOnce(true);
    fs.default.readFileSync.mockReturnValueOnce('{"v":"5.7.1","fr":30,"op":60,"layers":[]}');

    const lottieJson = { v: "5.7.1", fr: 30, op: 60, layers: [{ nm: "polished" }] };

    const chunks = [
      'data: {"choices":[{"delta":{"content":"Polished "}}]}\n\n',
      'data: {"choices":[{"delta":{"content":"it!"}}]}\n\n',
      "data: [DONE]\n\n",
    ];
    chatCompletionStreamMock.mockResolvedValueOnce(mockStreamResponse(chunks));
    parseResponseMock.mockReturnValueOnce({
      reply: "Polished it!",
      lottieJson,
      parseError: null,
      suggestions: [],
    });

    // saveVersion calls db.prepare().get() for max version
    dbGetMock.mockReturnValueOnce({ max_num: 1 });

    const resp = await handlePolish("anim1", "polish this");
    const text = await resp.text();
    const lines = text.split("\n").filter((l: string) => l.startsWith("data: "));

    const tokenEvents = lines
      .map((l: string) => JSON.parse(l.slice(6)))
      .filter((e: any) => e.type === "token");
    expect(tokenEvents).toHaveLength(2);
    expect(tokenEvents[0].text).toBe("Polished ");

    const doneEvent = lines
      .map((l: string) => JSON.parse(l.slice(6)))
      .find((e: any) => e.type === "done");
    expect(doneEvent.reply).toBe("Polished it!");
    expect(doneEvent.lottieJson).toEqual(lottieJson);
    expect(doneEvent.animationId).toBe("anim1");

    // File was written
    expect(fs.default.writeFileSync).toHaveBeenCalledWith(
      "/tmp/test-animations/anim1.json",
      JSON.stringify(lottieJson)
    );
  });
});
