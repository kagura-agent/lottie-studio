// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import JSZip from "jszip";
import { parseLottieFile } from "../importLottie";

/** Minimal valid Lottie JSON data. */
const VALID_LOTTIE = {
  v: "5.7.4",
  fr: 30,
  ip: 0,
  op: 60,
  w: 512,
  h: 512,
  layers: [{ ty: 4, nm: "Shape" }],
};

/** Create a File from a string with the given name. */
function jsonFile(name: string, content: string): File {
  return new File([content], name, { type: "application/json" });
}

/** Build a .lottie (ZIP) File containing a manifest and animation. */
async function buildDotLottieFile(
  name: string,
  opts: {
    manifest?: object | null;
    animationId?: string;
    animationData?: object | string | null;
  } = {},
): Promise<File> {
  const zip = new JSZip();
  const animId = opts.animationId ?? "anim_0";

  if (opts.manifest !== null) {
    const manifest = opts.manifest ?? { animations: [{ id: animId }] };
    zip.file("manifest.json", JSON.stringify(manifest));
  }

  if (opts.animationData !== null) {
    const data = opts.animationData ?? VALID_LOTTIE;
    zip.file(
      `animations/${animId}.json`,
      typeof data === "string" ? data : JSON.stringify(data),
    );
  }

  const buf = await zip.generateAsync({ type: "arraybuffer" });
  return new File([buf], name, { type: "application/octet-stream" });
}

describe("parseLottieFile", () => {
  // ── JSON files ───────────────────────────────────────────────
  it("parses a valid .json Lottie file", async () => {
    const file = jsonFile("bounce.json", JSON.stringify(VALID_LOTTIE));
    const result = await parseLottieFile(file);
    expect(result.name).toBe("bounce");
    expect(result.data).toEqual(VALID_LOTTIE);
  });

  it("rejects invalid JSON content", async () => {
    const file = jsonFile("bad.json", "{not json!!}");
    await expect(parseLottieFile(file)).rejects.toThrow("Invalid JSON");
  });

  it("rejects JSON missing required Lottie fields", async () => {
    const file = jsonFile("empty.json", JSON.stringify({ hello: "world" }));
    await expect(parseLottieFile(file)).rejects.toThrow("Invalid Lottie file");
  });

  // ── dotLottie (.lottie) files ────────────────────────────────
  it("parses a valid .lottie archive", async () => {
    const file = await buildDotLottieFile("cool.lottie");
    const result = await parseLottieFile(file);
    expect(result.name).toBe("cool");
    expect(result.data).toEqual(VALID_LOTTIE);
  });

  it("rejects .lottie with missing manifest.json", async () => {
    const file = await buildDotLottieFile("no-manifest.lottie", {
      manifest: null,
    });
    await expect(parseLottieFile(file)).rejects.toThrow("missing manifest.json");
  });

  it("rejects .lottie with empty animations array", async () => {
    const file = await buildDotLottieFile("empty-anims.lottie", {
      manifest: { animations: [] },
    });
    await expect(parseLottieFile(file)).rejects.toThrow(
      "no animations found in manifest",
    );
  });

  it("rejects .lottie with missing animation file", async () => {
    const file = await buildDotLottieFile("missing-anim.lottie", {
      animationId: "exists",
      manifest: { animations: [{ id: "does_not_exist" }] },
      animationData: null,
    });
    // The manifest references "does_not_exist" but we only wrote "exists"
    await expect(parseLottieFile(file)).rejects.toThrow("not found in archive");
  });

  // ── Unsupported extension ────────────────────────────────────
  it("rejects unsupported file extensions", async () => {
    const file = new File(["data"], "animation.gif", { type: "image/gif" });
    await expect(parseLottieFile(file)).rejects.toThrow(
      "Unsupported file type",
    );
  });
});
