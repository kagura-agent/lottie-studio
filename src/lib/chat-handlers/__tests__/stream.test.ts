import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  db: { prepare: vi.fn() },
  ANIMATIONS_DIR: "/tmp/test-animations",
  getAllPresets: vi.fn(() => []),
}));

vi.mock("@/lib/events", () => ({
  animationEvents: { emit: vi.fn() },
  emitWebhook: vi.fn(),
}));

vi.mock("@/lib/llm", () => ({
  chatCompletionStream: vi.fn(),
  chatCompletionRepairStream: vi.fn(),
  parseResponse: vi.fn(),
}));

vi.mock("@/lib/prompts", () => ({
  buildSystemPrompt: vi.fn(() => "system prompt"),
  buildDesignTokensPrompt: vi.fn(() => "design tokens prompt"),
  buildPresetPrompt: vi.fn(() => "preset prompt"),
}));

vi.mock("@/lib/chat-utils", () => ({
  compactHistory: vi.fn(() => []),
}));

vi.mock("@/lib/tag-inference", () => ({
  inferTags: vi.fn(() => []),
  serializeTags: vi.fn(() => ""),
}));

vi.mock("@/lib/description", () => ({
  extractDescription: vi.fn(() => null),
}));

vi.mock("@/lib/titleExtractor", () => ({
  default: vi.fn(() => "Test Animation"),
}));

vi.mock("@/lib/optimizer", () => ({
  validateAndFix: vi.fn(),
  roundDecimals: vi.fn(),
  removeEmptyGroups: vi.fn(),
  removeHiddenLayers: vi.fn(),
}));

vi.mock("node:crypto", () => ({
  randomUUID: () => "test-uuid",
}));

vi.mock("node:fs", () => ({
  default: {
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
    writeFileSync: vi.fn(),
  },
}));

import { db } from "@/lib/db";
import { animationEvents, emitWebhook } from "@/lib/events";
import { chatCompletionStream, chatCompletionRepairStream, parseResponse } from "@/lib/llm";
import { buildDesignTokensPrompt } from "@/lib/prompts";
import { inferTags, serializeTags } from "@/lib/tag-inference";
import { extractDescription } from "@/lib/description";
import { validateAndFix, roundDecimals, removeEmptyGroups, removeHiddenLayers } from "@/lib/optimizer";
import fs from "node:fs";
import { handleMainChat } from "../stream";

beforeEach(() => {
  vi.clearAllMocks();
});

function makeSSEStream(content: string): ReadableStream<Uint8Array> {
  const chunk = `data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\ndata: [DONE]\n\n`;
  return new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(chunk));
      controller.close();
    },
  });
}

function makeRequest(headers: Record<string, string> = {}): Request {
  return new Request("http://localhost/api/chat", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
  });
}

function setupDbForExisting() {
  const mockRun = vi.fn();
  const mockGet = vi.fn();
  const mockAll = vi.fn(() => []);
  (db.prepare as ReturnType<typeof vi.fn>).mockReturnValue({
    get: mockGet,
    run: mockRun,
    all: mockAll,
  });
  mockGet.mockReturnValue({ id: "anim1", template_source: null });
  return { mockRun, mockGet, mockAll };
}

function setupLottieResponse(lottieJson: object | null, extra: Record<string, unknown> = {}) {
  (parseResponse as ReturnType<typeof vi.fn>).mockReturnValue({
    reply: "Here you go",
    lottieJson,
    parseError: lottieJson ? null : "no_json",
    suggestions: null,
    command: null,
    ...extra,
  });
}

function setupOptimizer(json: object) {
  (validateAndFix as ReturnType<typeof vi.fn>).mockReturnValue({ fixed: json, warnings: [] });
  (roundDecimals as ReturnType<typeof vi.fn>).mockReturnValue(json);
  (removeEmptyGroups as ReturnType<typeof vi.fn>).mockReturnValue(json);
  (removeHiddenLayers as ReturnType<typeof vi.fn>).mockReturnValue(json);
}

async function readSSEResponse(res: Response): Promise<string> {
  return await res.text();
}

describe("handleMainChat", () => {
  it("creates a new animation when no animationId provided", async () => {
    const { mockRun } = setupDbForExisting();
    (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(false);

    const lottie = { v: "5", op: 60, fr: 30, layers: [] };
    const stream = makeSSEStream("Here ```json\n{}\n```");
    (chatCompletionStream as ReturnType<typeof vi.fn>).mockResolvedValue(new Response(stream));
    setupLottieResponse(lottie);
    setupOptimizer(lottie);

    const res = await handleMainChat(
      makeRequest(),
      { message: "make a circle" },
      undefined,
      undefined,
      null,
    );

    const text = await readSSEResponse(res);
    expect(text).toContain('"type":"done"');
    expect(mockRun).toHaveBeenCalled();
    expect(emitWebhook).toHaveBeenCalledWith(
      "animation.created",
      expect.objectContaining({ animationId: "test-uuid" }),
      undefined,
    );
  });

  it("returns 404 when animation not found", async () => {
    (db.prepare as ReturnType<typeof vi.fn>).mockReturnValue({
      get: () => undefined,
      run: vi.fn(),
      all: vi.fn(() => []),
    });

    const res = await handleMainChat(
      makeRequest(),
      { message: "hello" },
      "nonexistent-id",
      undefined,
      null,
    );

    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toBe("Animation not found");
  });

  it("deletes last user+assistant messages when regenerate is true", async () => {
    const mockRun = vi.fn();
    const mockGet = vi.fn();
    let callCount = 0;
    mockGet.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return { id: "anim1" };
      if (callCount === 2) return { id: "assistant-msg" };
      if (callCount === 3) return { id: "user-msg" };
      return { id: "anim1", template_source: null };
    });

    (db.prepare as ReturnType<typeof vi.fn>).mockReturnValue({
      get: mockGet,
      run: mockRun,
      all: vi.fn(() => []),
    });
    (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(false);

    const stream = makeSSEStream("regenerated");
    (chatCompletionStream as ReturnType<typeof vi.fn>).mockResolvedValue(new Response(stream));
    setupLottieResponse(null, { parseError: "no_json" });

    await handleMainChat(
      makeRequest(),
      { message: "try again", regenerate: true },
      "anim1",
      undefined,
      null,
    );

    const deleteCalls = mockRun.mock.calls.filter(
      (args: unknown[]) => args[0] === "assistant-msg" || args[0] === "user-msg"
    );
    expect(deleteCalls.length).toBe(2);
  });

  it("includes design tokens in system prompt", async () => {
    setupDbForExisting();
    (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(false);

    const stream = makeSSEStream("styled");
    (chatCompletionStream as ReturnType<typeof vi.fn>).mockResolvedValue(new Response(stream));
    setupLottieResponse(null, { parseError: "no_json" });

    await handleMainChat(
      makeRequest(),
      { message: "make it blue", designTokens: { primary: "#0000ff" } },
      "anim1",
      undefined,
      null,
    );

    expect(buildDesignTokensPrompt).toHaveBeenCalledWith({ primary: "#0000ff" });
  });

  it("includes layer context in system prompt", async () => {
    setupDbForExisting();
    (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(false);

    const stream = makeSSEStream("changed");
    (chatCompletionStream as ReturnType<typeof vi.fn>).mockResolvedValue(new Response(stream));
    setupLottieResponse(null, { parseError: "no_json" });

    await handleMainChat(
      makeRequest(),
      {
        message: "make it bigger",
        layerContext: { name: "Circle", type: "shape", index: 0 },
      },
      "anim1",
      undefined,
      null,
    );

    const callArgs = (chatCompletionStream as ReturnType<typeof vi.fn>).mock.calls[0][0];
    const systemMsg = callArgs[0].content;
    expect(systemMsg).toContain("Circle");
    expect(systemMsg).toContain("shape");
  });

  it("returns 502 when LLM request fails", async () => {
    setupDbForExisting();
    (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(false);
    (chatCompletionStream as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("LLM down"));

    const res = await handleMainChat(
      makeRequest(),
      { message: "hello" },
      "anim1",
      undefined,
      null,
    );

    expect(res.status).toBe(502);
    const json = await res.json();
    expect(json.error).toContain("LLM request failed");
  });

  it("returns 502 when LLM returns no body", async () => {
    setupDbForExisting();
    (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(false);
    (chatCompletionStream as ReturnType<typeof vi.fn>).mockResolvedValue(new Response(null));

    const res = await handleMainChat(
      makeRequest(),
      { message: "hello" },
      "anim1",
      undefined,
      null,
    );

    expect(res.status).toBe(502);
  });

  it("parses SSE chunks and emits token events", async () => {
    setupDbForExisting();
    (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(false);

    const stream = makeSSEStream("hello world");
    (chatCompletionStream as ReturnType<typeof vi.fn>).mockResolvedValue(new Response(stream));
    setupLottieResponse(null, { parseError: "no_json" });

    const res = await handleMainChat(
      makeRequest(),
      { message: "hello" },
      "anim1",
      undefined,
      null,
    );

    const text = await readSSEResponse(res);
    expect(text).toContain('"type":"token"');
    expect(text).toContain("hello world");
  });

  it("extracts reply and lottieJson from response", async () => {
    setupDbForExisting();
    (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(false);

    const lottie = { v: "5", op: 60, fr: 30, layers: [] };
    const stream = makeSSEStream("content");
    (chatCompletionStream as ReturnType<typeof vi.fn>).mockResolvedValue(new Response(stream));
    setupLottieResponse(lottie);
    setupOptimizer(lottie);

    const res = await handleMainChat(
      makeRequest(),
      { message: "make a circle" },
      "anim1",
      undefined,
      null,
    );

    const text = await readSSEResponse(res);
    expect(text).toContain('"type":"done"');
    expect(text).toContain('"reply"');
    expect(text).toContain('"lottieJson"');
    expect(parseResponse).toHaveBeenCalled();
  });

  it("triggers repair stream on invalid_json parse error", async () => {
    setupDbForExisting();
    (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(false);

    const lottie = { v: "5", op: 60, fr: 30, layers: [] };
    const stream = makeSSEStream("broken json");
    (chatCompletionStream as ReturnType<typeof vi.fn>).mockResolvedValue(new Response(stream));
    (parseResponse as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce({ reply: "oops", lottieJson: null, parseError: "invalid_json", suggestions: null, command: null })
      .mockReturnValueOnce({ reply: "fixed", lottieJson: lottie, parseError: null, suggestions: null, command: null });

    const repairStream = makeSSEStream("repaired");
    (chatCompletionRepairStream as ReturnType<typeof vi.fn>).mockResolvedValue(new Response(repairStream));
    setupOptimizer(lottie);

    const res = await handleMainChat(
      makeRequest(),
      { message: "make something" },
      "anim1",
      undefined,
      null,
    );

    const text = await readSSEResponse(res);
    expect(text).toContain('"type":"repairing"');
    expect(text).toContain('"type":"repair_token"');
    expect(chatCompletionRepairStream).toHaveBeenCalled();
  });

  it("validates and optimizes Lottie, saves file, creates version", async () => {
    setupDbForExisting();
    (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(false);

    const lottie = { v: "5", op: 60, fr: 30, layers: [] };
    const stream = makeSSEStream("animation");
    (chatCompletionStream as ReturnType<typeof vi.fn>).mockResolvedValue(new Response(stream));
    setupLottieResponse(lottie);
    setupOptimizer(lottie);

    const res = await handleMainChat(
      makeRequest(),
      { message: "make a circle" },
      "anim1",
      undefined,
      null,
    );

    await readSSEResponse(res);

    expect(validateAndFix).toHaveBeenCalledWith(lottie);
    expect(roundDecimals).toHaveBeenCalled();
    expect(removeEmptyGroups).toHaveBeenCalled();
    expect(removeHiddenLayers).toHaveBeenCalled();
    expect(fs.writeFileSync).toHaveBeenCalled();
    expect(animationEvents.emit).toHaveBeenCalledWith("updated", { animationId: "anim1" });
  });

  it("saves tags and description when present", async () => {
    setupDbForExisting();
    (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(false);

    const lottie = { v: "5", op: 60, fr: 30, layers: [] };
    const stream = makeSSEStream("animation");
    (chatCompletionStream as ReturnType<typeof vi.fn>).mockResolvedValue(new Response(stream));
    setupLottieResponse(lottie);
    setupOptimizer(lottie);
    (inferTags as ReturnType<typeof vi.fn>).mockReturnValue(["circle", "shape"]);
    (serializeTags as ReturnType<typeof vi.fn>).mockReturnValue("circle,shape");
    (extractDescription as ReturnType<typeof vi.fn>).mockReturnValue("A circle animation");

    const res = await handleMainChat(
      makeRequest(),
      { message: "make a circle" },
      "anim1",
      undefined,
      null,
    );

    await readSSEResponse(res);

    expect(inferTags).toHaveBeenCalledWith("make a circle");
    expect(serializeTags).toHaveBeenCalledWith(["circle", "shape"]);
    expect(extractDescription).toHaveBeenCalledWith("Here you go");
  });

  it("deletes new animation when LLM returns no Lottie JSON", async () => {
    const mockRun = vi.fn();
    (db.prepare as ReturnType<typeof vi.fn>).mockReturnValue({
      get: vi.fn().mockReturnValue({ id: "anim1", template_source: null }),
      run: mockRun,
      all: vi.fn(() => []),
    });
    (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(false);

    const stream = makeSSEStream("just text, no animation");
    (chatCompletionStream as ReturnType<typeof vi.fn>).mockResolvedValue(new Response(stream));
    setupLottieResponse(null, { parseError: "no_json" });

    const res = await handleMainChat(
      makeRequest(),
      { message: "hello" },
      undefined,
      undefined,
      null,
    );

    await readSSEResponse(res);

    const deleteAnimCalls = mockRun.mock.calls.filter(
      (args: unknown[]) => args[0] === "test-uuid"
    );
    expect(deleteAnimCalls.length).toBeGreaterThanOrEqual(1);
  });

  it("emits done event with all expected fields", async () => {
    setupDbForExisting();
    (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);
    (fs.readFileSync as ReturnType<typeof vi.fn>).mockReturnValue('{"v":"4","layers":[]}');

    const lottie = { v: "5", op: 60, fr: 30, layers: [] };
    const stream = makeSSEStream("done");
    (chatCompletionStream as ReturnType<typeof vi.fn>).mockResolvedValue(new Response(stream));
    (parseResponse as ReturnType<typeof vi.fn>).mockReturnValue({
      reply: "Here you go",
      lottieJson: lottie,
      parseError: null,
      suggestions: ["try adding color"],
      command: null,
    });
    setupOptimizer(lottie);

    const res = await handleMainChat(
      makeRequest(),
      { message: "make a circle" },
      "anim1",
      undefined,
      null,
    );

    const text = await readSSEResponse(res);
    const doneMatch = text.match(/data: (\{.*"type":"done".*\})\n/);
    expect(doneMatch).toBeTruthy();
    const done = JSON.parse(doneMatch![1]);
    expect(done.type).toBe("done");
    expect(done.reply).toBe("Here you go");
    expect(done.lottieJson).toBeDefined();
    expect(done.animationId).toBe("anim1");
    expect(done.suggestions).toEqual(["try adding color"]);
    expect(done.previousLottieJson).toEqual({ v: "4", layers: [] });
  });

  it("includes warning in done event for parse errors", async () => {
    setupDbForExisting();
    (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(false);

    const stream = makeSSEStream("no json here");
    (chatCompletionStream as ReturnType<typeof vi.fn>).mockResolvedValue(new Response(stream));
    setupLottieResponse(null, { parseError: "invalid_json" });

    const res = await handleMainChat(
      makeRequest(),
      { message: "make something" },
      "anim1",
      undefined,
      null,
    );

    const text = await readSSEResponse(res);
    expect(text).toContain("malformed");
  });

  it("uses higher temperature for regeneration", async () => {
    setupDbForExisting();
    (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(false);

    const stream = makeSSEStream("regen");
    (chatCompletionStream as ReturnType<typeof vi.fn>).mockResolvedValue(new Response(stream));
    setupLottieResponse(null, { parseError: "no_json" });

    await handleMainChat(
      makeRequest(),
      { message: "try again", regenerate: true },
      "anim1",
      undefined,
      null,
    );

    const callArgs = (chatCompletionStream as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(callArgs[1]).toEqual({ temperature: 0.9 });
  });

  it("includes style instruction when message has STYLE prefix", async () => {
    setupDbForExisting();
    (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);
    (fs.readFileSync as ReturnType<typeof vi.fn>).mockReturnValue('{"v":"5","layers":[]}');

    const stream = makeSSEStream("styled");
    (chatCompletionStream as ReturnType<typeof vi.fn>).mockResolvedValue(new Response(stream));
    setupLottieResponse(null, { parseError: "no_json" });

    await handleMainChat(
      makeRequest(),
      { message: "[STYLE: neon] make it glow" },
      "anim1",
      undefined,
      null,
    );

    const callArgs = (chatCompletionStream as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(callArgs[0].content).toContain("STYLE INSTRUCTION");
  });

  it("includes animate instruction when message has ANIMATE prefix", async () => {
    setupDbForExisting();
    (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);
    (fs.readFileSync as ReturnType<typeof vi.fn>).mockReturnValue('{"v":"5","layers":[]}');

    const stream = makeSSEStream("animated");
    (chatCompletionStream as ReturnType<typeof vi.fn>).mockResolvedValue(new Response(stream));
    setupLottieResponse(null, { parseError: "no_json" });

    await handleMainChat(
      makeRequest(),
      { message: "[ANIMATE: bounce] add bounce" },
      "anim1",
      undefined,
      null,
    );

    const callArgs = (chatCompletionStream as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(callArgs[0].content).toContain("MOTION INSTRUCTION");
  });

  it("includes validation warnings in done event", async () => {
    setupDbForExisting();
    (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(false);

    const lottie = { v: "5", op: 60, fr: 30, layers: [] };
    const stream = makeSSEStream("animation");
    (chatCompletionStream as ReturnType<typeof vi.fn>).mockResolvedValue(new Response(stream));
    setupLottieResponse(lottie);
    (validateAndFix as ReturnType<typeof vi.fn>).mockReturnValue({ fixed: lottie, warnings: ["missing width"] });
    (roundDecimals as ReturnType<typeof vi.fn>).mockReturnValue(lottie);
    (removeEmptyGroups as ReturnType<typeof vi.fn>).mockReturnValue(lottie);
    (removeHiddenLayers as ReturnType<typeof vi.fn>).mockReturnValue(lottie);

    const res = await handleMainChat(
      makeRequest(),
      { message: "make a circle" },
      "anim1",
      undefined,
      null,
    );

    const text = await readSSEResponse(res);
    expect(text).toContain("missing width");
  });
});
