import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {
    prepare: vi.fn(() => ({ run: vi.fn(), get: vi.fn() })),
  },
  ANIMATIONS_DIR: "/tmp/test-animations",
}));

vi.mock("@/lib/events", () => ({
  animationEvents: { emit: vi.fn() },
}));

vi.mock("node:fs", () => ({
  default: { existsSync: vi.fn(), readFileSync: vi.fn(), writeFileSync: vi.fn() },
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
}));

describe("chat-handlers/helpers", () => {
  let helpers: typeof import("../helpers");
  let dbMock: { prepare: ReturnType<typeof vi.fn> };
  let fsMock: typeof import("node:fs") & { default: typeof import("node:fs") };

  beforeEach(async () => {
    vi.resetModules();
    vi.mock("@/lib/db", () => ({
      db: {
        prepare: vi.fn(() => ({ run: vi.fn(), get: vi.fn() })),
      },
      ANIMATIONS_DIR: "/tmp/test-animations",
    }));
    vi.mock("@/lib/events", () => ({
      animationEvents: { emit: vi.fn() },
    }));
    helpers = await import("../helpers");
    const db = await import("@/lib/db");
    dbMock = db.db as unknown as { prepare: ReturnType<typeof vi.fn> };
    fsMock = await import("node:fs");
  });

  describe("sendDoneEvent", () => {
    it("returns a Response with SSE-formatted done event", async () => {
      const resp = helpers.sendDoneEvent({ reply: "hello", animationId: "abc" });
      expect(resp).toBeInstanceOf(Response);
      expect(resp.headers.get("Content-Type")).toBe("text/event-stream");
      const text = await resp.text();
      const parsed = JSON.parse(text.replace("data: ", "").trim());
      expect(parsed.type).toBe("done");
      expect(parsed.reply).toBe("hello");
      expect(parsed.animationId).toBe("abc");
    });
  });

  describe("encodeSSE", () => {
    it("encodes string as SSE data line", () => {
      const result = helpers.encodeSSE("test");
      const decoded = new TextDecoder().decode(result);
      expect(decoded).toBe("data: test\n\n");
    });
  });

  describe("animationExists", () => {
    it("returns true when animation found", () => {
      const getMock = vi.fn(() => ({ id: "abc" }));
      dbMock.prepare.mockReturnValue({ get: getMock });
      expect(helpers.animationExists("abc")).toBe(true);
      expect(getMock).toHaveBeenCalledWith("abc");
    });

    it("returns false when animation not found", () => {
      dbMock.prepare.mockReturnValue({ get: vi.fn(() => undefined) });
      expect(helpers.animationExists("missing")).toBe(false);
    });
  });

  describe("saveVersion", () => {
    it("increments version number and inserts", () => {
      const runMock = vi.fn();
      dbMock.prepare
        .mockReturnValueOnce({ get: vi.fn(() => ({ max_num: 3 })) })
        .mockReturnValueOnce({ run: runMock });
      const result = helpers.saveVersion("anim1", '{"v":"5"}', "test msg");
      expect(result).toBe(4);
      expect(runMock).toHaveBeenCalledWith("anim1", 4, '{"v":"5"}', "test msg");
    });

    it("starts at version 1 when no previous versions", () => {
      const runMock = vi.fn();
      dbMock.prepare
        .mockReturnValueOnce({ get: vi.fn(() => ({ max_num: null })) })
        .mockReturnValueOnce({ run: runMock });
      const result = helpers.saveVersion("anim1", "{}", "first");
      expect(result).toBe(1);
    });
  });

  describe("saveUserMessage", () => {
    it("inserts user message into db", () => {
      const runMock = vi.fn();
      dbMock.prepare.mockReturnValue({ run: runMock });
      helpers.saveUserMessage("anim1", "hello");
      expect(runMock).toHaveBeenCalledWith(expect.any(String), "anim1", "hello", null);
    });

    it("passes image URL when provided", () => {
      const runMock = vi.fn();
      dbMock.prepare.mockReturnValue({ run: runMock });
      helpers.saveUserMessage("anim1", "hello", "http://img.png");
      expect(runMock).toHaveBeenCalledWith(expect.any(String), "anim1", "hello", "http://img.png");
    });
  });

  describe("saveAssistantMessage", () => {
    it("inserts assistant message with lottie json", () => {
      const runMock = vi.fn();
      dbMock.prepare.mockReturnValue({ run: runMock });
      helpers.saveAssistantMessage("anim1", "done", '{"v":"5"}', '{"v":"4"}');
      expect(runMock).toHaveBeenCalledWith(expect.any(String), "anim1", "done", '{"v":"5"}', '{"v":"4"}');
    });
  });

  describe("updateAnimationMetadata", () => {
    it("calculates duration from frame count and rate", () => {
      const runMock = vi.fn();
      dbMock.prepare.mockReturnValue({ run: runMock });
      helpers.updateAnimationMetadata("anim1", { op: 60, fr: 30 });
      expect(runMock).toHaveBeenCalledWith(60, 2, "anim1");
    });

    it("uses default 30fps when fr not provided", () => {
      const runMock = vi.fn();
      dbMock.prepare.mockReturnValue({ run: runMock });
      helpers.updateAnimationMetadata("anim1", { op: 90 });
      expect(runMock).toHaveBeenCalledWith(90, 3, "anim1");
    });
  });

  describe("readAnimationFile", () => {
    it("returns parsed JSON when file exists", () => {
      vi.mocked(fsMock.default.existsSync).mockReturnValue(true);
      vi.mocked(fsMock.default.readFileSync).mockReturnValue('{"v":"5"}');
      const result = helpers.readAnimationFile("abc");
      expect(result).toEqual({ v: "5" });
    });

    it("returns null when file does not exist", () => {
      vi.mocked(fsMock.default.existsSync).mockReturnValue(false);
      expect(helpers.readAnimationFile("missing")).toBeNull();
    });

    it("returns null when JSON is invalid", () => {
      vi.mocked(fsMock.default.existsSync).mockReturnValue(true);
      vi.mocked(fsMock.default.readFileSync).mockReturnValue("not json");
      expect(helpers.readAnimationFile("bad")).toBeNull();
    });
  });

  describe("writeAnimationFile", () => {
    it("writes stringified JSON to file", () => {
      helpers.writeAnimationFile("abc", { v: "5" });
      expect(fsMock.default.writeFileSync).toHaveBeenCalledWith(
        "/tmp/test-animations/abc.json",
        '{"v":"5"}'
      );
    });
  });

  describe("emitUpdated", () => {
    it("emits updated event", async () => {
      const { animationEvents } = await import("@/lib/events");
      helpers.emitUpdated("abc");
      expect(animationEvents.emit).toHaveBeenCalledWith("updated", { animationId: "abc" });
    });
  });
});
