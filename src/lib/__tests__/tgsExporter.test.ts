import { describe, it, expect, vi, beforeAll } from "vitest";
import { exportToTgs, validateForTgs } from "../tgsExporter";

// Polyfill CompressionStream for Node.js test environment
beforeAll(async () => {
  if (typeof globalThis.CompressionStream === "undefined") {
    const { createGzip } = await import("node:zlib");
    const { Readable } = await import("node:stream");

    class MockCompressionStream {
      readable: ReadableStream<Uint8Array>;
      writable: WritableStream<Uint8Array>;

      constructor(_format: string) {
        const chunks: Uint8Array[] = [];
        let resolveReadable: (stream: ReadableStream<Uint8Array>) => void;
        const readablePromise = new Promise<ReadableStream<Uint8Array>>(
          (r) => (resolveReadable = r)
        );

        this.writable = new WritableStream<Uint8Array>({
          write(chunk) {
            chunks.push(chunk);
          },
          close() {
            // Compress all accumulated data
            const gzip = createGzip();
            const inputBuffer = Buffer.concat(chunks);
            const compressedChunks: Buffer[] = [];

            gzip.on("data", (chunk: Buffer) => compressedChunks.push(chunk));
            gzip.on("end", () => {
              const compressed = Buffer.concat(compressedChunks);
              const resultStream = new ReadableStream<Uint8Array>({
                start(controller) {
                  controller.enqueue(new Uint8Array(compressed));
                  controller.close();
                },
              });
              resolveReadable!(resultStream);
            });

            gzip.end(inputBuffer);
          },
        });

        this.readable = null as unknown as ReadableStream<Uint8Array>;
        // We need to make readable available synchronously, so use a proxy pattern
        this.readable = new ReadableStream<Uint8Array>({
          async start(controller) {
            const stream = await readablePromise;
            const reader = stream.getReader();
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              controller.enqueue(value);
            }
            controller.close();
          },
        });
      }
    }

    (globalThis as unknown as Record<string, unknown>).CompressionStream =
      MockCompressionStream;
  }
});

function makeAnimation(overrides: Record<string, unknown> = {}) {
  return {
    v: "5.7.0",
    fr: 30,
    ip: 0,
    op: 60, // 2 seconds
    w: 512,
    h: 512,
    layers: [
      {
        ty: 4, // shape layer
        nm: "Shape",
        ind: 0,
        ip: 0,
        op: 60,
        ks: { p: { a: 0, k: [256, 256] }, s: { a: 0, k: [100, 100] } },
        shapes: [
          {
            ty: "rc",
            p: { a: 0, k: [0, 0] },
            s: { a: 0, k: [100, 100] },
          },
        ],
      },
    ],
    assets: [],
    ...overrides,
  };
}

describe("tgsExporter", () => {
  describe("exportToTgs", () => {
    it("exports a basic valid animation successfully", async () => {
      const anim = makeAnimation();
      const result = await exportToTgs(anim);

      expect(result.blob).toBeInstanceOf(Blob);
      expect(result.blob.type).toBe("application/gzip");
      expect(result.compressedSize).toBeGreaterThan(0);
      expect(result.compressedSize).toBeLessThanOrEqual(64 * 1024);
      expect(result.warnings).toHaveLength(0);
    });

    it("returns a gzipped blob", async () => {
      const anim = makeAnimation();
      const result = await exportToTgs(anim);
      const buffer = await result.blob.arrayBuffer();
      const bytes = new Uint8Array(buffer);

      // Gzip magic number: 0x1f 0x8b
      expect(bytes[0]).toBe(0x1f);
      expect(bytes[1]).toBe(0x8b);
    });

    it("strips image layers with warning", async () => {
      const anim = makeAnimation({
        layers: [
          { ty: 4, nm: "Shape", ind: 0, ip: 0, op: 60, ks: {}, shapes: [] },
          { ty: 2, nm: "Image", ind: 1, ip: 0, op: 60, ks: {} },
        ],
      });

      const result = await exportToTgs(anim);
      expect(result.warnings).toContain("Stripped 1 image layer(s)");

      // Verify the blob contains valid gzipped JSON without the image layer
      const { gunzipSync } = await import("node:zlib");
      const buffer = Buffer.from(await result.blob.arrayBuffer());
      const json = JSON.parse(gunzipSync(buffer).toString());
      expect(json.layers).toHaveLength(1);
      expect(json.layers[0].ty).toBe(4);
    });

    it("strips text layers with warning", async () => {
      const anim = makeAnimation({
        layers: [
          { ty: 4, nm: "Shape", ind: 0, ip: 0, op: 60, ks: {}, shapes: [] },
          { ty: 5, nm: "Text", ind: 1, ip: 0, op: 60, ks: {} },
          { ty: 5, nm: "Text2", ind: 2, ip: 0, op: 60, ks: {} },
        ],
      });

      const result = await exportToTgs(anim);
      expect(result.warnings).toContain("Stripped 2 text layer(s)");
    });

    it("truncates animation longer than 3s with warning", async () => {
      // 5 seconds at 30fps = 150 frames
      const anim = makeAnimation({ op: 150 });

      const result = await exportToTgs(anim);
      expect(result.warnings.some((w) => w.includes("Truncated duration"))).toBe(true);
      expect(result.warnings.some((w) => w.includes("3s"))).toBe(true);

      // Verify truncated in output
      const { gunzipSync } = await import("node:zlib");
      const buffer = Buffer.from(await result.blob.arrayBuffer());
      const json = JSON.parse(gunzipSync(buffer).toString());
      expect(json.op).toBe(90); // 3s at 30fps
    });

    it("throws error if compressed size exceeds 64KB", async () => {
      // Create a very large animation with lots of keyframes
      const hugeLayers = [];
      for (let i = 0; i < 200; i++) {
        const keyframes = [];
        for (let f = 0; f < 30; f++) {
          keyframes.push({
            t: f * 3,
            s: [Math.random() * 512, Math.random() * 512, 0],
            e: [Math.random() * 512, Math.random() * 512, 0],
            i: { x: [Math.random()], y: [Math.random()] },
            o: { x: [Math.random()], y: [Math.random()] },
          });
        }
        hugeLayers.push({
          ty: 4,
          nm: `Layer${i}`,
          ind: i,
          ip: 0,
          op: 90,
          ks: {
            p: { a: 1, k: keyframes },
            s: { a: 1, k: keyframes },
            r: { a: 1, k: keyframes },
            o: { a: 1, k: keyframes },
          },
          shapes: [
            {
              ty: "rc",
              p: { a: 1, k: keyframes },
              s: { a: 1, k: keyframes },
            },
          ],
        });
      }

      const anim = makeAnimation({ layers: hugeLayers, op: 90 });

      await expect(exportToTgs(anim)).rejects.toThrow("exceeds 64KB limit");
    });

    it("handles empty layers array", async () => {
      const anim = makeAnimation({ layers: [] });
      const result = await exportToTgs(anim);

      expect(result.blob).toBeInstanceOf(Blob);
      expect(result.compressedSize).toBeGreaterThan(0);
    });

    it("handles animation with no layers property", async () => {
      const anim = { v: "5.7.0", fr: 30, ip: 0, op: 60, w: 512, h: 512 };
      const result = await exportToTgs(anim);

      expect(result.blob).toBeInstanceOf(Blob);
      expect(result.compressedSize).toBeGreaterThan(0);
    });

    it("removes expressions with warning", async () => {
      const anim = makeAnimation({
        layers: [
          {
            ty: 4,
            nm: "Expr",
            ind: 0,
            ip: 0,
            op: 60,
            ks: {
              p: { a: 0, k: [256, 256], x: "wiggle(2, 50)" },
            },
            shapes: [],
          },
        ],
      });

      const result = await exportToTgs(anim);
      expect(result.warnings).toContain("Removed expressions");

      const { gunzipSync } = await import("node:zlib");
      const buffer = Buffer.from(await result.blob.arrayBuffer());
      const json = JSON.parse(gunzipSync(buffer).toString());
      expect(json.layers[0].ks.p.x).toBeUndefined();
    });

    it("sets tgs=1 in output", async () => {
      const anim = makeAnimation();
      const result = await exportToTgs(anim);

      const { gunzipSync } = await import("node:zlib");
      const buffer = Buffer.from(await result.blob.arrayBuffer());
      const json = JSON.parse(gunzipSync(buffer).toString());
      expect(json.tgs).toBe(1);
    });
  });

  describe("validateForTgs", () => {
    it("returns valid for a conforming animation", () => {
      const anim = makeAnimation();
      const result = validateForTgs(anim);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });

    it("warns about non-512 canvas", () => {
      const anim = makeAnimation({ w: 1024, h: 768 });
      const result = validateForTgs(anim);

      expect(result.valid).toBe(true);
      expect(result.warnings.some((w) => w.includes("1024×768"))).toBe(true);
    });

    it("warns about duration exceeding 3s", () => {
      const anim = makeAnimation({ op: 150 }); // 5s at 30fps
      const result = validateForTgs(anim);

      expect(result.valid).toBe(true);
      expect(result.warnings.some((w) => w.includes("truncated"))).toBe(true);
    });

    it("errors on fps exceeding 60", () => {
      const anim = makeAnimation({ fr: 120 });
      const result = validateForTgs(anim);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("120fps"))).toBe(true);
    });

    it("warns about image layers", () => {
      const anim = makeAnimation({
        layers: [
          { ty: 2, nm: "Image1" },
          { ty: 2, nm: "Image2" },
        ],
      });
      const result = validateForTgs(anim);

      expect(result.warnings.some((w) => w.includes("2 image layer"))).toBe(true);
    });

    it("warns about text layers", () => {
      const anim = makeAnimation({
        layers: [{ ty: 5, nm: "Text" }],
      });
      const result = validateForTgs(anim);

      expect(result.warnings.some((w) => w.includes("1 text layer"))).toBe(true);
    });

    it("returns appropriate results for animation with no layers", () => {
      const anim = { v: "5.7.0", fr: 30, ip: 0, op: 60, w: 512, h: 512 };
      const result = validateForTgs(anim);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });
});
