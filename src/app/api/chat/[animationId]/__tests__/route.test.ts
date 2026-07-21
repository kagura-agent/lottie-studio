import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ──────────────────────────────────────────────────────────────────

const mockGet = vi.fn();
const mockAll = vi.fn();
const mockRun = vi.fn();

vi.mock("@/lib/db", () => ({
  db: {
    prepare: () => ({ get: mockGet, all: mockAll, run: mockRun }),
  },
}));

// ── Helpers ────────────────────────────────────────────────────────────────

function makeParams(animationId: string) {
  return { params: Promise.resolve({ animationId }) };
}

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/chat/anim-1", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function importRoute() {
  return await import("../route");
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe("/api/chat/[animationId] route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── GET ─────────────────────────────────────────────────────────────────

  describe("GET", () => {
    it("returns 404 if animation does not exist", async () => {
      mockGet.mockReturnValue(undefined);

      const { GET } = await importRoute();
      const res = await GET(new Request("http://localhost"), makeParams("no-exist"));

      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.error).toBe("Animation not found");
    });

    it("returns messages with parsed lottie_json fields", async () => {
      const lottie = { v: "5.7.0", layers: [] };
      const prevLottie = { v: "5.6.0", layers: [1] };

      mockGet.mockReturnValue({ id: "anim-1", template_source: "preset-bounce" });
      mockAll.mockReturnValue([
        {
          id: "msg-1",
          role: "user",
          content: "hello",
          lottie_json: JSON.stringify(lottie),
          image_url: null,
          previous_lottie_json: JSON.stringify(prevLottie),
          created_at: "2026-01-01T00:00:00Z",
        },
      ]);

      const { GET } = await importRoute();
      const res = await GET(new Request("http://localhost"), makeParams("anim-1"));

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.animationId).toBe("anim-1");
      expect(json.templateSource).toBe("preset-bounce");
      expect(json.messages).toHaveLength(1);
      expect(json.messages[0].lottieJson).toEqual(lottie);
      expect(json.messages[0].previousLottieJson).toEqual(prevLottie);
    });

    it("returns null for lottieJson/previousLottieJson when stored as null", async () => {
      mockGet.mockReturnValue({ id: "anim-1", template_source: null });
      mockAll.mockReturnValue([
        {
          id: "msg-1",
          role: "assistant",
          content: "hi",
          lottie_json: null,
          image_url: "http://img.png",
          previous_lottie_json: null,
          created_at: "2026-01-01T00:00:00Z",
        },
      ]);

      const { GET } = await importRoute();
      const res = await GET(new Request("http://localhost"), makeParams("anim-1"));

      const json = await res.json();
      expect(json.templateSource).toBeNull();
      expect(json.messages[0].lottieJson).toBeNull();
      expect(json.messages[0].previousLottieJson).toBeNull();
      expect(json.messages[0].imageUrl).toBe("http://img.png");
    });

    it("returns empty messages array when no messages exist", async () => {
      mockGet.mockReturnValue({ id: "anim-1", template_source: null });
      mockAll.mockReturnValue([]);

      const { GET } = await importRoute();
      const res = await GET(new Request("http://localhost"), makeParams("anim-1"));

      const json = await res.json();
      expect(json.messages).toEqual([]);
    });

    it("imageUrl is undefined when image_url is empty string", async () => {
      mockGet.mockReturnValue({ id: "anim-1", template_source: null });
      mockAll.mockReturnValue([
        {
          id: "msg-1",
          role: "user",
          content: "x",
          lottie_json: null,
          image_url: "",
          previous_lottie_json: null,
          created_at: "2026-01-01T00:00:00Z",
        },
      ]);

      const { GET } = await importRoute();
      const res = await GET(new Request("http://localhost"), makeParams("anim-1"));

      const json = await res.json();
      expect(json.messages[0].imageUrl).toBeUndefined();
    });
  });

  // ─── DELETE ──────────────────────────────────────────────────────────────

  describe("DELETE", () => {
    it("returns 404 if animation does not exist", async () => {
      mockGet.mockReturnValue(undefined);

      const { DELETE } = await importRoute();
      const res = await DELETE(new Request("http://localhost"), makeParams("no-exist"));

      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.error).toBe("Animation not found");
    });

    it("deletes all messages and returns success", async () => {
      mockGet.mockReturnValue({ id: "anim-1" });

      const { DELETE } = await importRoute();
      const res = await DELETE(new Request("http://localhost"), makeParams("anim-1"));

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(mockRun).toHaveBeenCalledWith("anim-1");
    });
  });

  // ─── PATCH ──────────────────────────────────────────────────────────────

  describe("PATCH", () => {
    it("returns 404 if animation does not exist", async () => {
      mockGet.mockReturnValue(undefined);

      const { PATCH } = await importRoute();
      const res = await PATCH(
        makeRequest({ messageId: "msg-1", newContent: "updated" }),
        makeParams("no-exist")
      );

      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.error).toBe("Animation not found");
    });

    it("returns 400 if messageId is missing", async () => {
      mockGet.mockReturnValue({ id: "anim-1" });

      const { PATCH } = await importRoute();
      const res = await PATCH(
        makeRequest({ newContent: "updated" }),
        makeParams("anim-1")
      );

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe("messageId and newContent are required");
    });

    it("returns 400 if newContent is missing", async () => {
      mockGet.mockReturnValue({ id: "anim-1" });

      const { PATCH } = await importRoute();
      const res = await PATCH(
        makeRequest({ messageId: "msg-1" }),
        makeParams("anim-1")
      );

      expect(res.status).toBe(400);
    });

    it("returns 400 if newContent is not a string", async () => {
      mockGet.mockReturnValue({ id: "anim-1" });

      const { PATCH } = await importRoute();
      const res = await PATCH(
        makeRequest({ messageId: "msg-1", newContent: 123 }),
        makeParams("anim-1")
      );

      expect(res.status).toBe(400);
    });

    it("returns 404 if message not found", async () => {
      // First call: animation exists; second call: message not found
      mockGet.mockReturnValueOnce({ id: "anim-1" }).mockReturnValueOnce(undefined);

      const { PATCH } = await importRoute();
      const res = await PATCH(
        makeRequest({ messageId: "msg-99", newContent: "updated" }),
        makeParams("anim-1")
      );

      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.error).toBe("Message not found");
    });

    it("deletes subsequent messages and updates content on success", async () => {
      mockGet
        .mockReturnValueOnce({ id: "anim-1" })
        .mockReturnValueOnce({ id: "msg-1", created_at: "2026-01-01T00:00:00Z" });

      const { PATCH } = await importRoute();
      const res = await PATCH(
        makeRequest({ messageId: "msg-1", newContent: "new text" }),
        makeParams("anim-1")
      );

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);

      // First run call: delete messages after created_at
      expect(mockRun).toHaveBeenCalledWith("anim-1", "2026-01-01T00:00:00Z");
      // Second run call: update message content
      expect(mockRun).toHaveBeenCalledWith("new text", "msg-1");
    });
  });
});
