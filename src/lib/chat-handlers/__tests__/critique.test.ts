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
import { chatCompletionStream } from "@/lib/llm";
import fs from "node:fs";
import { handleCritique } from "../critique";

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

describe("handleCritique", () => {
  it("returns error when no animationId", async () => {
    const res = await handleCritique(undefined, "critique");
    const text = await res.text();
    expect(text).toContain("Create an animation first");
  });

  it("returns 404 when animation not in DB", async () => {
    (db.prepare as ReturnType<typeof vi.fn>).mockReturnValue({ get: () => undefined });
    const res = await handleCritique("anim1", "critique");
    expect(res.status).toBe(404);
  });

  it("returns message when animation file missing", async () => {
    (db.prepare as ReturnType<typeof vi.fn>).mockReturnValue({ get: () => ({ id: "anim1" }), run: vi.fn() });
    (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(false);
    const res = await handleCritique("anim1", "critique");
    const text = await res.text();
    expect(text).toContain("Create an animation first");
  });

  it("returns 502 when LLM throws", async () => {
    (db.prepare as ReturnType<typeof vi.fn>).mockReturnValue({ get: () => ({ id: "anim1" }), run: vi.fn() });
    (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);
    (fs.readFileSync as ReturnType<typeof vi.fn>).mockReturnValue('{"v":"5"}');
    (chatCompletionStream as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("LLM down"));

    const res = await handleCritique("anim1", "critique");
    expect(res.status).toBe(502);
  });

  it("returns 502 when LLM returns no body", async () => {
    (db.prepare as ReturnType<typeof vi.fn>).mockReturnValue({ get: () => ({ id: "anim1" }), run: vi.fn() });
    (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);
    (fs.readFileSync as ReturnType<typeof vi.fn>).mockReturnValue('{"v":"5"}');
    (chatCompletionStream as ReturnType<typeof vi.fn>).mockResolvedValue(new Response(null));

    const res = await handleCritique("anim1", "critique");
    expect(res.status).toBe(502);
  });

  it("streams critique response as SSE", async () => {
    (db.prepare as ReturnType<typeof vi.fn>).mockReturnValue({ get: () => ({ id: "anim1" }), run: vi.fn() });
    (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);
    (fs.readFileSync as ReturnType<typeof vi.fn>).mockReturnValue('{"v":"5"}');

    const stream = makeSSEStream("Great animation!");
    (chatCompletionStream as ReturnType<typeof vi.fn>).mockResolvedValue(new Response(stream));

    const res = await handleCritique("anim1", "/critique");
    expect(res.headers.get("Content-Type")).toBe("text/event-stream");

    const text = await res.text();
    expect(text).toContain("Great animation!");
    expect(text).toContain('"type":"done"');
  });
});
