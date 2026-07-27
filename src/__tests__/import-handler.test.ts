import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/chat-handlers/helpers", () => ({
  sendDoneEvent: vi.fn((payload: unknown) => Response.json(payload)),
  saveVersion: vi.fn(),
  updateAnimationMetadata: vi.fn(),
  emitUpdated: vi.fn(),
  writeAnimationFile: vi.fn(),
  saveAssistantMessage: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    prepare: () => ({ run: vi.fn() }),
  },
}));

vi.mock("node:crypto", () => ({
  randomUUID: () => "test-uuid-1234",
}));

vi.mock("jszip", () => ({
  default: { loadAsync: vi.fn() },
}));

import { handleImport } from "@/lib/chat-handlers/import";
import JSZip from "jszip";
import { writeAnimationFile } from "@/lib/chat-handlers/helpers";
import { db } from "@/lib/db";

const mockLoadAsync = vi.mocked(JSZip.loadAsync);
const validLottie = { v: "5.0", layers: [{ nm: "L" }], w: 100, h: 100, fr: 30 };

function mockFetchResponse(body: unknown, opts: { ok?: boolean; status?: number; contentLength?: string | null; arrayBuffer?: ArrayBuffer } = {}) {
  const { ok = true, status = 200, contentLength = null } = opts;
  const buf = opts.arrayBuffer ?? new TextEncoder().encode(typeof body === "string" ? body : JSON.stringify(body)).buffer;
  const headers = new Headers();
  if (contentLength !== null) headers.set("content-length", contentLength);
  return {
    ok,
    status,
    headers,
    arrayBuffer: () => Promise.resolve(buf),
  } as unknown as globalThis.Response;
}

describe("handleImport", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn());
  });

  it("returns network error on fetch failure", async () => {
    vi.mocked(globalThis.fetch).mockRejectedValue(new Error("ECONNREFUSED"));
    const res = await handleImport("https://example.com/anim.json");
    const data = await res.json();
    expect(data.reply).toContain("Network error");
  });

  it("returns timeout message on AbortError", async () => {
    const err = new Error("aborted");
    err.name = "AbortError";
    vi.mocked(globalThis.fetch).mockRejectedValue(err);
    const res = await handleImport("https://example.com/anim.json");
    const data = await res.json();
    expect(data.reply).toContain("timed out");
  });

  it("returns error on HTTP error response", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(mockFetchResponse("", { ok: false, status: 404 }));
    const res = await handleImport("https://example.com/anim.json");
    const data = await res.json();
    expect(data.reply).toContain("HTTP 404");
  });

  it("returns error when content-length exceeds MAX_SIZE", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(mockFetchResponse("", { contentLength: "10000000" }));
    const res = await handleImport("https://example.com/anim.json");
    const data = await res.json();
    expect(data.reply).toContain("too large");
  });

  it("returns error when body exceeds MAX_SIZE", async () => {
    const bigBuf = new ArrayBuffer(6 * 1024 * 1024);
    vi.mocked(globalThis.fetch).mockResolvedValue(mockFetchResponse("", { arrayBuffer: bigBuf }));
    const res = await handleImport("https://example.com/anim.json");
    const data = await res.json();
    expect(data.reply).toContain("too large");
  });

  it("imports valid JSON lottie successfully", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(mockFetchResponse(validLottie));
    const res = await handleImport("https://example.com/animation.json");
    const data = await res.json();
    expect(data.reply).toContain("Imported");
    expect(data.reply).toContain("animation");
    expect(data.animationId).toBe("test-uuid-1234");
    expect(vi.mocked(writeAnimationFile)).toHaveBeenCalled();
  });

  it("returns error for invalid JSON", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(mockFetchResponse("not json {{{", { arrayBuffer: new TextEncoder().encode("not json {{{").buffer }));
    const res = await handleImport("https://example.com/anim.json");
    const data = await res.json();
    expect(data.reply).toContain("Invalid JSON");
  });

  it("returns error for non-object lottie (array)", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(mockFetchResponse([1, 2, 3]));
    const res = await handleImport("https://example.com/anim.json");
    const data = await res.json();
    expect(data.reply).toContain("expected a JSON object");
  });

  it("returns error for lottie missing v", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(mockFetchResponse({ layers: [], w: 100, h: 100 }));
    const res = await handleImport("https://example.com/anim.json");
    const data = await res.json();
    expect(data.reply).toContain("missing version");
  });

  it("returns error for lottie missing layers", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(mockFetchResponse({ v: "5", w: 100, h: 100 }));
    const res = await handleImport("https://example.com/anim.json");
    const data = await res.json();
    expect(data.reply).toContain("layers");
  });

  it("returns error for lottie with non-array layers", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(mockFetchResponse({ v: "5", layers: "bad", w: 100, h: 100 }));
    const res = await handleImport("https://example.com/anim.json");
    const data = await res.json();
    expect(data.reply).toContain("layers");
  });

  it("returns error for lottie missing w", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(mockFetchResponse({ v: "5", layers: [], h: 100 }));
    const res = await handleImport("https://example.com/anim.json");
    const data = await res.json();
    expect(data.reply).toContain("width");
  });

  it("returns error for lottie missing h", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(mockFetchResponse({ v: "5", layers: [], w: 100 }));
    const res = await handleImport("https://example.com/anim.json");
    const data = await res.json();
    expect(data.reply).toContain("height");
  });

  it("returns error for null lottie data", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(mockFetchResponse("null", { arrayBuffer: new TextEncoder().encode("null").buffer }));
    const res = await handleImport("https://example.com/anim.json");
    const data = await res.json();
    expect(data.reply).toContain("expected a JSON object");
  });

  describe("dotLottie (.lottie) path", () => {
    it("extracts animation from valid dotLottie", async () => {
      const manifestJson = JSON.stringify({ animations: [{ id: "anim1" }] });
      const animJson = JSON.stringify(validLottie);
      const mockZip = {
        file: (name: string) => {
          if (name === "manifest.json") return { async: () => Promise.resolve(manifestJson) };
          if (name === "animations/anim1.json") return { async: () => Promise.resolve(animJson) };
          return null;
        },
      };
      mockLoadAsync.mockResolvedValue(mockZip);
      vi.mocked(globalThis.fetch).mockResolvedValue(mockFetchResponse(""));

      const res = await handleImport("https://example.com/anim.lottie");
      const data = await res.json();
      expect(data.reply).toContain("Imported");
    });

    it("returns error when manifest.json is missing", async () => {
      mockLoadAsync.mockResolvedValue({ file: () => null });
      vi.mocked(globalThis.fetch).mockResolvedValue(mockFetchResponse(""));

      const res = await handleImport("https://example.com/anim.lottie");
      const data = await res.json();
      expect(data.reply).toContain("Missing manifest.json");
    });

    it("returns error when no animations in manifest", async () => {
      const mockZip = {
        file: (name: string) => {
          if (name === "manifest.json") return { async: () => Promise.resolve(JSON.stringify({ animations: [] })) };
          return null;
        },
      };
      mockLoadAsync.mockResolvedValue(mockZip);
      vi.mocked(globalThis.fetch).mockResolvedValue(mockFetchResponse(""));

      const res = await handleImport("https://example.com/test.lottie");
      const data = await res.json();
      expect(data.reply).toContain("No animations in manifest");
    });

    it("returns error when animation file not found in archive", async () => {
      const mockZip = {
        file: (name: string) => {
          if (name === "manifest.json") return { async: () => Promise.resolve(JSON.stringify({ animations: [{ id: "missing" }] })) };
          return null;
        },
      };
      mockLoadAsync.mockResolvedValue(mockZip);
      vi.mocked(globalThis.fetch).mockResolvedValue(mockFetchResponse(""));

      const res = await handleImport("https://example.com/test.lottie");
      const data = await res.json();
      expect(data.reply).toContain("Animation file not found");
    });

    it("returns error for invalid JSON in dotLottie animation", async () => {
      const mockZip = {
        file: (name: string) => {
          if (name === "manifest.json") return { async: () => Promise.resolve(JSON.stringify({ animations: [{ id: "a" }] })) };
          if (name === "animations/a.json") return { async: () => Promise.resolve("not json") };
          return null;
        },
      };
      mockLoadAsync.mockResolvedValue(mockZip);
      vi.mocked(globalThis.fetch).mockResolvedValue(mockFetchResponse(""));

      const res = await handleImport("https://example.com/test.lottie");
      const data = await res.json();
      expect(data.reply).toContain("Invalid .lottie file");
    });
  });

  describe("extractName", () => {
    it("extracts name from URL without extension", async () => {
      vi.mocked(globalThis.fetch).mockResolvedValue(mockFetchResponse(validLottie));
      const res = await handleImport("https://example.com/myanimation");
      const data = await res.json();
      expect(data.reply).toContain("myanimation");
    });

    it("strips .json extension from name", async () => {
      vi.mocked(globalThis.fetch).mockResolvedValue(mockFetchResponse(validLottie));
      const res = await handleImport("https://example.com/cool.json");
      const data = await res.json();
      expect(data.reply).toContain("cool");
    });

    it("strips .lottie extension from name", async () => {
      const manifestJson = JSON.stringify({ animations: [{ id: "a" }] });
      const animJson = JSON.stringify(validLottie);
      mockLoadAsync.mockResolvedValue({
        file: (name: string) => {
          if (name === "manifest.json") return { async: () => Promise.resolve(manifestJson) };
          if (name === "animations/a.json") return { async: () => Promise.resolve(animJson) };
          return null;
        },
      });
      vi.mocked(globalThis.fetch).mockResolvedValue(mockFetchResponse(""));
      const res = await handleImport("https://example.com/myfile.lottie");
      const data = await res.json();
      expect(data.reply).toContain("myfile");
    });

    it("uses 'imported' for invalid URL", async () => {
      vi.mocked(globalThis.fetch).mockResolvedValue(mockFetchResponse(validLottie));
      const res = await handleImport("not-a-valid-url");
      const data = await res.json();
      expect(data.reply).toContain("imported");
    });
  });
});
