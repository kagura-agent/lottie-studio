import { randomUUID } from "node:crypto";
import JSZip from "jszip";
import { db, ANIMATIONS_DIR } from "@/lib/db";
import {
  sendDoneEvent,
  saveVersion,
  updateAnimationMetadata,
  emitUpdated,
  writeAnimationFile,
  saveAssistantMessage,
} from "./helpers";

const TIMEOUT_MS = 10_000;
const MAX_SIZE = 5 * 1024 * 1024;

function validateLottie(data: unknown): asserts data is Record<string, unknown> {
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    throw new Error("Invalid Lottie: expected a JSON object");
  }
  const obj = data as Record<string, unknown>;
  if (!("v" in obj)) throw new Error("Invalid Lottie: missing version (v)");
  if (!("layers" in obj) || !Array.isArray(obj.layers)) throw new Error("Invalid Lottie: missing or invalid layers array");
  if (typeof obj.w !== "number") throw new Error("Invalid Lottie: missing width (w)");
  if (typeof obj.h !== "number") throw new Error("Invalid Lottie: missing height (h)");
}

function extractName(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    const filename = pathname.split("/").pop() || "imported";
    return filename.replace(/\.(json|lottie)$/i, "") || "imported";
  } catch {
    return "imported";
  }
}

export async function handleImport(
  url: string,
  animationId: string | undefined,
  _request: Request,
): Promise<Response> {
  let response: globalThis.Response;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    response = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
  } catch (err: unknown) {
    const msg = err instanceof Error && err.name === "AbortError"
      ? "Request timed out after 10 seconds."
      : "Network error: could not fetch the URL.";
    return sendDoneEvent({ reply: msg });
  }

  if (!response.ok) {
    return sendDoneEvent({ reply: `Failed to fetch: HTTP ${response.status}` });
  }

  const contentLength = response.headers.get("content-length");
  if (contentLength && parseInt(contentLength, 10) > MAX_SIZE) {
    return sendDoneEvent({ reply: "File too large (exceeds 5 MB limit)." });
  }

  const buf = await response.arrayBuffer();
  if (buf.byteLength > MAX_SIZE) {
    return sendDoneEvent({ reply: "File too large (exceeds 5 MB limit)." });
  }

  let lottieData: Record<string, unknown>;
  const isLottieZip = url.toLowerCase().endsWith(".lottie");

  if (isLottieZip) {
    try {
      const zip = await JSZip.loadAsync(buf);
      const manifestFile = zip.file("manifest.json");
      if (!manifestFile) throw new Error("Missing manifest.json");
      const manifest = JSON.parse(await manifestFile.async("text")) as { animations?: { id: string }[] };
      if (!manifest.animations || manifest.animations.length === 0) throw new Error("No animations in manifest");
      const animFileId = manifest.animations[0].id;
      const animFile = zip.file(`animations/${animFileId}.json`);
      if (!animFile) throw new Error("Animation file not found in archive");
      const parsed = JSON.parse(await animFile.async("text"));
      validateLottie(parsed);
      lottieData = parsed;
    } catch (err: unknown) {
      const detail = err instanceof Error ? err.message : "unknown error";
      return sendDoneEvent({ reply: `Invalid .lottie file: ${detail}` });
    }
  } else {
    let text: string;
    try {
      text = new TextDecoder().decode(buf);
    } catch {
      return sendDoneEvent({ reply: "Could not decode response as text." });
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      return sendDoneEvent({ reply: "Invalid JSON: could not parse the response." });
    }
    try {
      validateLottie(parsed);
      lottieData = parsed as Record<string, unknown>;
    } catch (err: unknown) {
      const detail = err instanceof Error ? err.message : "Invalid Lottie structure";
      return sendDoneEvent({ reply: detail });
    }
  }

  const name = extractName(url);
  const newId = randomUUID();

  db.prepare(
    "INSERT INTO animations (id, name, created_at, updated_at) VALUES (?, ?, datetime('now'), datetime('now'))"
  ).run(newId, name);

  writeAnimationFile(newId, lottieData);
  updateAnimationMetadata(newId, lottieData);

  const lottieStr = JSON.stringify(lottieData);
  saveVersion(newId, lottieStr, `/import ${url}`);
  saveAssistantMessage(newId, `Imported "${name}" from URL.`, lottieStr);

  emitUpdated(newId);

  return sendDoneEvent({
    reply: `Imported "${name}" successfully.`,
    lottieJson: lottieData,
    animationId: newId,
  });
}
