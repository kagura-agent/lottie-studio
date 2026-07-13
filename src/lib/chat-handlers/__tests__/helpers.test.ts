import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  db: { prepare: vi.fn() },
  ANIMATIONS_DIR: "/tmp/test-animations",
}));

vi.mock("@/lib/events", () => ({
  animationEvents: { emit: vi.fn() },
}));

vi.mock("node:crypto", () => ({
  randomUUID: () => "test-uuid-1234",
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
import fs from "node:fs";
import {
  SSE_HEADERS,
  createSSEResponse,
  sendDoneEvent,
  encodeSSE,
  saveUserMessage,
  saveAssistantMessage,
  updateAnimationMetadata,
  saveVersion,
  emitUpdated,
  readAnimationFile,
  readAnimationFileRaw,
  writeAnimationFile,
  animationExists,
  createStreamingSSEResponse,
} from "../helpers";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("SSE_HEADERS", () => {
  it("has correct content type", () => {
    expect(SSE_HEADERS["Content-Type"]).toBe("text/event-stream");
  });
});

describe("encodeSSE", () => {
  it("encodes data as SSE format", () => {
    const result = encodeSSE("hello");
    const text = new TextDecoder().decode(result);
    expect(text).toBe("data: hello\n\n");
  });
});

describe("createSSEResponse", () => {
  it("returns a Response with SSE headers", () => {
    const body = new TextEncoder().encode("data: test\n\n");
    const res = createSSEResponse(body);
    expect(res.headers.get("Content-Type")).toBe("text/event-stream");
  });
});

describe("sendDoneEvent", () => {
  it("returns SSE response with done type", async () => {
    const res = sendDoneEvent({ reply: "hi", animationId: "abc" });
    const text = await res.text();
    const parsed = JSON.parse(text.replace("data: ", "").trim());
    expect(parsed.type).toBe("done");
    expect(parsed.reply).toBe("hi");
  });
});

describe("saveUserMessage", () => {
  it("inserts a user message into DB", () => {
    const run = vi.fn();
    (db.prepare as ReturnType<typeof vi.fn>).mockReturnValue({ run });
    saveUserMessage("anim1", "hello");
    expect(db.prepare).toHaveBeenCalledWith(expect.stringContaining("INSERT INTO messages"));
    expect(run).toHaveBeenCalledWith("test-uuid-1234", "anim1", "hello", null);
  });

  it("passes imageUrl when provided", () => {
    const run = vi.fn();
    (db.prepare as ReturnType<typeof vi.fn>).mockReturnValue({ run });
    saveUserMessage("anim1", "hello", "http://img.png");
    expect(run).toHaveBeenCalledWith("test-uuid-1234", "anim1", "hello", "http://img.png");
  });
});

describe("saveAssistantMessage", () => {
  it("inserts an assistant message into DB", () => {
    const run = vi.fn();
    (db.prepare as ReturnType<typeof vi.fn>).mockReturnValue({ run });
    saveAssistantMessage("anim1", "reply text", '{"v":"5"}', '{"v":"4"}');
    expect(run).toHaveBeenCalledWith("test-uuid-1234", "anim1", "reply text", '{"v":"5"}', '{"v":"4"}');
  });
});

describe("updateAnimationMetadata", () => {
  it("computes duration and updates DB", () => {
    const run = vi.fn();
    (db.prepare as ReturnType<typeof vi.fn>).mockReturnValue({ run });
    updateAnimationMetadata("anim1", { op: 60, fr: 30 });
    expect(run).toHaveBeenCalledWith(60, 2, "anim1");
  });

  it("handles missing op", () => {
    const run = vi.fn();
    (db.prepare as ReturnType<typeof vi.fn>).mockReturnValue({ run });
    updateAnimationMetadata("anim1", { fr: 30 });
    expect(run).toHaveBeenCalledWith(null, null, "anim1");
  });
});

describe("saveVersion", () => {
  it("increments version and inserts", () => {
    const run = vi.fn();
    const get = vi.fn().mockReturnValue({ max_num: 3 });
    (db.prepare as ReturnType<typeof vi.fn>).mockReturnValueOnce({ get }).mockReturnValueOnce({ run });
    const v = saveVersion("anim1", '{"v":"5"}', "test msg");
    expect(v).toBe(4);
    expect(run).toHaveBeenCalledWith("anim1", 4, '{"v":"5"}', "test msg");
  });

  it("starts at 1 when no versions exist", () => {
    const run = vi.fn();
    const get = vi.fn().mockReturnValue({ max_num: null });
    (db.prepare as ReturnType<typeof vi.fn>).mockReturnValueOnce({ get }).mockReturnValueOnce({ run });
    const v = saveVersion("anim1", '{}', "init");
    expect(v).toBe(1);
  });
});

describe("emitUpdated", () => {
  it("emits updated event", () => {
    emitUpdated("anim1");
    expect(animationEvents.emit).toHaveBeenCalledWith("updated", { animationId: "anim1" });
  });
});

describe("readAnimationFile", () => {
  it("returns parsed JSON if file exists", () => {
    (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);
    (fs.readFileSync as ReturnType<typeof vi.fn>).mockReturnValue('{"v":"5"}');
    const result = readAnimationFile("anim1");
    expect(result).toEqual({ v: "5" });
  });

  it("returns null if file does not exist", () => {
    (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(false);
    const result = readAnimationFile("anim1");
    expect(result).toBeNull();
  });

  it("returns null on parse error", () => {
    (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);
    (fs.readFileSync as ReturnType<typeof vi.fn>).mockReturnValue("not json");
    const result = readAnimationFile("anim1");
    expect(result).toBeNull();
  });
});

describe("readAnimationFileRaw", () => {
  it("returns raw string if file exists", () => {
    (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);
    (fs.readFileSync as ReturnType<typeof vi.fn>).mockReturnValue('{"v":"5"}');
    const result = readAnimationFileRaw("anim1");
    expect(result).toBe('{"v":"5"}');
  });

  it("returns null if file does not exist", () => {
    (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(false);
    expect(readAnimationFileRaw("anim1")).toBeNull();
  });
});

describe("writeAnimationFile", () => {
  it("writes JSON to file", () => {
    writeAnimationFile("anim1", { v: "5" });
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      "/tmp/test-animations/anim1.json",
      JSON.stringify({ v: "5" })
    );
  });
});

describe("animationExists", () => {
  it("returns true when row exists", () => {
    (db.prepare as ReturnType<typeof vi.fn>).mockReturnValue({ get: () => ({ id: "anim1" }) });
    expect(animationExists("anim1")).toBe(true);
  });

  it("returns false when row missing", () => {
    (db.prepare as ReturnType<typeof vi.fn>).mockReturnValue({ get: () => undefined });
    expect(animationExists("anim1")).toBe(false);
  });
});

describe("createStreamingSSEResponse", () => {
  it("returns response with SSE headers", () => {
    const stream = new ReadableStream({ start(c) { c.close(); } });
    const res = createStreamingSSEResponse(stream);
    expect(res.headers.get("Content-Type")).toBe("text/event-stream");
  });
});
