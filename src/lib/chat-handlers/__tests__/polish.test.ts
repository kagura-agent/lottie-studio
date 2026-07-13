import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  db: { prepare: vi.fn() },
  ANIMATIONS_DIR: "/tmp/test-animations",
}));

vi.mock("@/lib/events", () => ({
  animationEvents: { emit: vi.fn() },
}));

vi.mock("@/lib/llm", () => ({
  chatCompletionStream: vi.fn(),
  parseResponse: vi.fn(),
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
import { animationEvents } from "@/lib/events";
import { chatCompletionStream, parseResponse } from "@/lib/llm";
import { validateAndFix, roundDecimals, removeEmptyGroups, removeHiddenLayers } from "@/lib/optimizer";
import fs from "node:fs";
import { handlePolish } from "../polish";

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

describe("handlePolish", () => {
  it("returns error when no animationId", async () => {
    const res = await handlePolish(undefined, "polish");
    const text = await res.text();
    expect(text).toContain("Create an animation first");
  });

  it("returns 404 when animation not in DB", async () => {
    (db.prepare as ReturnType<typeof vi.fn>).mockReturnValue({ get: () => undefined });
    const res = await handlePolish("anim1", "polish");
    expect(res.status).toBe(404);
  });

  it("returns message when animation file missing", async () => {
    (db.prepare as ReturnType<typeof vi.fn>).mockReturnValue({ get: () => ({ id: "anim1" }), run: vi.fn() });
    (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(false);
    const res = await handlePolish("anim1", "polish");
    const text = await res.text();
    expect(text).toContain("Create an animation first");
  });

  it("returns 502 when LLM throws", async () => {
    (db.prepare as ReturnType<typeof vi.fn>).mockReturnValue({ get: () => ({ id: "anim1" }), run: vi.fn() });
    (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);
    (fs.readFileSync as ReturnType<typeof vi.fn>).mockReturnValue('{"v":"5"}');
    (chatCompletionStream as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("fail"));

    const res = await handlePolish("anim1", "polish");
    expect(res.status).toBe(502);
  });

  it("streams polish response and applies optimizations", async () => {
    const polishedJson = { v: "5", op: 60, fr: 30, layers: [{ nm: "polished" }] };
    (db.prepare as ReturnType<typeof vi.fn>).mockReturnValue({ get: () => ({ id: "anim1", max_num: 1 }), run: vi.fn() });
    (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);
    (fs.readFileSync as ReturnType<typeof vi.fn>).mockReturnValue('{"v":"5","op":60,"fr":30,"layers":[]}');

    const stream = makeSSEStream("Here is improved\n```json\n{}\n```");
    (chatCompletionStream as ReturnType<typeof vi.fn>).mockResolvedValue(new Response(stream));
    (parseResponse as ReturnType<typeof vi.fn>).mockReturnValue({ lottieJson: polishedJson, text: "improved" });
    (validateAndFix as ReturnType<typeof vi.fn>).mockReturnValue({ fixed: polishedJson, errors: [] });
    (roundDecimals as ReturnType<typeof vi.fn>).mockReturnValue(polishedJson);
    (removeEmptyGroups as ReturnType<typeof vi.fn>).mockReturnValue(polishedJson);
    (removeHiddenLayers as ReturnType<typeof vi.fn>).mockReturnValue(polishedJson);

    const res = await handlePolish("anim1", "/polish");
    expect(res.headers.get("Content-Type")).toBe("text/event-stream");

    const text = await res.text();
    expect(text).toContain('"type":"done"');
    expect(fs.writeFileSync).toHaveBeenCalled();
    expect(animationEvents.emit).toHaveBeenCalledWith("updated", { animationId: "anim1" });
  });

  it("does not write file when parseResponse returns no JSON", async () => {
    (db.prepare as ReturnType<typeof vi.fn>).mockReturnValue({ get: () => ({ id: "anim1", max_num: 1 }), run: vi.fn() });
    (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);
    (fs.readFileSync as ReturnType<typeof vi.fn>).mockReturnValue('{"v":"5"}');

    const stream = makeSSEStream("No JSON here");
    (chatCompletionStream as ReturnType<typeof vi.fn>).mockResolvedValue(new Response(stream));
    (parseResponse as ReturnType<typeof vi.fn>).mockReturnValue({ lottieJson: null, text: "No JSON" });

    const res = await handlePolish("anim1", "/polish");
    const text = await res.text();
    expect(text).toContain('"type":"done"');
    expect(fs.writeFileSync).not.toHaveBeenCalled();
    expect(animationEvents.emit).not.toHaveBeenCalled();
  });
});
