import { describe, it, expect, vi, beforeEach } from "vitest";
import JSZip from "jszip";

vi.mock("@/lib/db", () => ({
  db: { prepare: vi.fn() },
  ANIMATIONS_DIR: "/tmp/test-animations",
}));

vi.mock("@/lib/events", () => ({
  animationEvents: { emit: vi.fn() },
}));

vi.mock("node:crypto", () => ({
  randomUUID: () => "test-uuid-import",
}));

vi.mock("node:fs", () => ({
  default: {
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
    writeFileSync: vi.fn(),
    mkdirSync: vi.fn(),
  },
}));

import { db } from "@/lib/db";
import { handleImport } from "../import";

const validLottie = { v: "5.7.1", layers: [{ ty: 4 }], w: 512, h: 512, fr: 30, op: 60 };

function mockDbChain() {
  (db.prepare as ReturnType<typeof vi.fn>).mockReturnValue({
    run: vi.fn(),
    get: vi.fn(() => ({ max_num: 0 })),
  });
}

async function parseDoneEvent(res: Response): Promise<Record<string, unknown>> {
  const text = await res.text();
  const json = text.replace("data: ", "").trim();
  return JSON.parse(json);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockDbChain();
  vi.stubGlobal("fetch", vi.fn());
});

describe("handleImport", () => {
  it("imports valid JSON successfully", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(JSON.stringify(validLottie), { status: 200 })
    );

    const res = await handleImport("https://example.com/anim.json", undefined, new Request("http://x"));
    const data = await parseDoneEvent(res);

    expect(data.reply).toContain("anim");
    expect(data.animationId).toBe("test-uuid-import");
    expect((data.lottieJson as Record<string, unknown>).v).toBe("5.7.1");
  });

  it("imports valid .lottie zip successfully", async () => {
    const zip = new JSZip();
    zip.file("manifest.json", JSON.stringify({ animations: [{ id: "anim1" }] }));
    zip.file("animations/anim1.json", JSON.stringify(validLottie));
    const buf = await zip.generateAsync({ type: "arraybuffer" });

    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(buf, { status: 200 })
    );

    const res = await handleImport("https://example.com/cool.lottie", undefined, new Request("http://x"));
    const data = await parseDoneEvent(res);

    expect(data.reply).toContain("cool");
    expect(data.lottieJson).toBeDefined();
  });

  it("handles network timeout", async () => {
    const abortErr = new Error("aborted");
    abortErr.name = "AbortError";
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(abortErr);

    const res = await handleImport("https://example.com/slow.json", undefined, new Request("http://x"));
    const data = await parseDoneEvent(res);

    expect(data.reply).toContain("timed out");
  });

  it("handles oversized response via content-length", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response("x", { status: 200, headers: { "content-length": "10000000" } })
    );

    const res = await handleImport("https://example.com/big.json", undefined, new Request("http://x"));
    const data = await parseDoneEvent(res);

    expect(data.reply).toContain("too large");
  });

  it("handles oversized response via body size", async () => {
    const big = Buffer.alloc(6 * 1024 * 1024, "x");
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(big, { status: 200 })
    );

    const res = await handleImport("https://example.com/big.json", undefined, new Request("http://x"));
    const data = await parseDoneEvent(res);

    expect(data.reply).toContain("too large");
  });

  it("handles invalid JSON response", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response("not json {{{", { status: 200 })
    );

    const res = await handleImport("https://example.com/bad.json", undefined, new Request("http://x"));
    const data = await parseDoneEvent(res);

    expect(data.reply).toContain("Invalid JSON");
  });

  it("handles invalid Lottie structure", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(JSON.stringify({ hello: "world" }), { status: 200 })
    );

    const res = await handleImport("https://example.com/notlottie.json", undefined, new Request("http://x"));
    const data = await parseDoneEvent(res);

    expect(data.reply).toContain("Invalid Lottie");
  });

  it("handles non-200 HTTP response", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response("Not Found", { status: 404 })
    );

    const res = await handleImport("https://example.com/missing.json", undefined, new Request("http://x"));
    const data = await parseDoneEvent(res);

    expect(data.reply).toContain("404");
  });

  it("handles generic network error", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("ECONNREFUSED"));

    const res = await handleImport("https://example.com/down.json", undefined, new Request("http://x"));
    const data = await parseDoneEvent(res);

    expect(data.reply).toContain("Network error");
  });
});
