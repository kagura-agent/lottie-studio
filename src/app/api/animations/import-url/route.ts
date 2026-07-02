import { db, ANIMATIONS_DIR } from "@/lib/db";
import { chatCompletion } from "@/lib/llm";
import { buildSystemPrompt } from "@/lib/prompts";
import { convertSvgToLottie } from "@/lib/svg-to-lottie";
import { describeLayersForLLM } from "@/app/api/import-svg/route";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import JSZip from "jszip";

export const dynamic = "force-dynamic";

function validateLottieData(data: unknown): asserts data is Record<string, unknown> {
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    throw new Error("Invalid Lottie file: expected a JSON object");
  }
  const obj = data as Record<string, unknown>;
  if (!("v" in obj)) throw new Error("Invalid Lottie file: missing version (v)");
  if (!("layers" in obj) || !Array.isArray(obj.layers)) throw new Error("Invalid Lottie file: missing or invalid layers array");
  if (typeof obj.w !== "number") throw new Error("Invalid Lottie file: missing width (w)");
  if (typeof obj.h !== "number") throw new Error("Invalid Lottie file: missing height (h)");
}

async function parseFromZip(buffer: ArrayBuffer): Promise<{ name: string; data: object }> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(buffer);
  } catch {
    throw new Error("Failed to unzip archive");
  }

  // Try .lottie format first (with manifest)
  const manifestFile = zip.file("manifest.json");
  if (manifestFile) {
    let manifest: { animations?: { id: string }[] };
    try {
      manifest = JSON.parse(await manifestFile.async("text"));
    } catch {
      throw new Error("Could not parse manifest.json");
    }

    if (!manifest.animations || manifest.animations.length === 0) {
      throw new Error("No animations found in manifest");
    }

    const animId = manifest.animations[0].id;
    const animPath = `animations/${animId}.json`;
    const animFile = zip.file(animPath);
    if (!animFile) {
      throw new Error(`Animation "${animId}" not found in archive`);
    }

    let data: unknown;
    try {
      data = JSON.parse(await animFile.async("text"));
    } catch {
      throw new Error("Could not parse animation JSON");
    }

    validateLottieData(data);
    const name = (data as Record<string, unknown>).nm as string || "Imported Animation";
    return { name, data: data as object };
  }

  // Fallback: look for animation.json in root
  const animFile = zip.file("animation.json");
  if (!animFile) {
    throw new Error("No animation.json found in archive");
  }

  let data: unknown;
  try {
    data = JSON.parse(await animFile.async("text"));
  } catch {
    throw new Error("Could not parse animation.json");
  }

  validateLottieData(data);
  const name = (data as Record<string, unknown>).nm as string || "Imported Animation";
  return { name, data: data as object };
}

function extractNameFromUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    const filename = pathname.split("/").pop() || "Imported Animation";
    return filename.replace(/\.(json|lottie)$/i, "");
  } catch {
    return "Imported Animation";
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { url } = body;

    if (!url || typeof url !== "string") {
      return Response.json({ error: "url is required" }, { status: 400 });
    }

    // Validate URL
    let urlObj: URL;
    try {
      urlObj = new URL(url);
    } catch {
      return Response.json({ error: "Invalid URL" }, { status: 400 });
    }

    // Only allow http/https
    if (!["http:", "https:"].includes(urlObj.protocol)) {
      return Response.json({ error: "Only HTTP(S) URLs are supported" }, { status: 400 });
    }

    // Fetch with timeout and size check
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    let response: Response;
    try {
      response = await fetch(url, { signal: controller.signal });
    } catch (err) {
      clearTimeout(timeoutId);
      if ((err as Error).name === "AbortError") {
        return Response.json({ error: "Request timed out" }, { status: 408 });
      }
      return Response.json({ error: "Failed to fetch URL" }, { status: 500 });
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      return Response.json(
        { error: `Failed to fetch: ${response.status} ${response.statusText}` },
        { status: 502 }
      );
    }

    // Check Content-Length header
    const contentLength = response.headers.get("content-length");
    if (contentLength) {
      const sizeInMB = parseInt(contentLength, 10) / (1024 * 1024);
      if (sizeInMB > 5) {
        return Response.json({ error: "File too large (max 5MB)" }, { status: 413 });
      }
    }

    // Read response
    const buffer = await response.arrayBuffer();

    // Check actual size
    const sizeInMB = buffer.byteLength / (1024 * 1024);
    if (sizeInMB > 5) {
      return Response.json({ error: "File too large (max 5MB)" }, { status: 413 });
    }

    // Detect content type
    const contentType = response.headers.get("content-type") || "";
    let name: string;
    let data: object;
    let isSvgImport = false;

    // Check if it's SVG content
    if (
      contentType.includes("image/svg+xml") ||
      url.toLowerCase().endsWith(".svg")
    ) {
      const svgText = new TextDecoder().decode(buffer);
      if (!svgText.includes("<svg")) {
        return Response.json({ error: "Invalid SVG: missing <svg> element" }, { status: 400 });
      }
      try {
        const result = convertSvgToLottie(svgText);
        data = result.data;
        name = extractNameFromUrl(url).replace(/\.svg$/i, "") || "Imported SVG";
        isSvgImport = true;
      } catch (err) {
        return Response.json(
          { error: err instanceof Error ? err.message : "SVG conversion failed" },
          { status: 400 }
        );
      }
    } else if (
      contentType.includes("zip") ||
      contentType.includes("application/octet-stream") ||
      url.toLowerCase().endsWith(".lottie")
    ) {
      try {
        const result = await parseFromZip(buffer);
        name = result.name;
        data = result.data;
      } catch {
        // If zip parsing fails, try JSON
        try {
          const text = new TextDecoder().decode(buffer);
          const parsed: unknown = JSON.parse(text);
          validateLottieData(parsed);
          data = parsed as object;
          name = (data as Record<string, unknown>).nm as string || extractNameFromUrl(url);
        } catch {
          return Response.json({ error: "Could not parse as JSON or zip archive" }, { status: 400 });
        }
      }
    } else {
      // Try JSON first
      try {
        const text = new TextDecoder().decode(buffer);
        const parsed: unknown = JSON.parse(text);
        validateLottieData(parsed);
        data = parsed as object;
        name = (data as Record<string, unknown>).nm as string || extractNameFromUrl(url);
      } catch {
        // If JSON parsing fails, try zip
        try {
          const result = await parseFromZip(buffer);
          name = result.name;
          data = result.data;
        } catch {
          return Response.json({ error: "Could not parse as JSON or zip archive" }, { status: 400 });
        }
      }
    }

    // Generate ID and save
    const id = randomUUID();
    let finalData = data;
    let importMessage: string | undefined;

    // Auto-animate SVG imports via LLM
    if (isSvgImport) {
      const lottieObj = data as Record<string, unknown>;
      const layers = (lottieObj.layers as unknown[]) || [];

      if (layers.length > 0) {
        try {
          const systemPrompt = buildSystemPrompt(data);
          const layerDescription = describeLayersForLLM(layers);
          const userMessage = `I just imported an SVG called "${name}" which has been converted to a static Lottie with ${layers.length} layer${layers.length !== 1 ? "s" : ""}:\n\n${layerDescription}\n\nPlease analyze the layer structure and apply contextually appropriate animations. Add entrance animations (fade in, scale up, or slide in with staggered timing), and where appropriate, add subtle looping animations (gentle floating, pulsing, or rotation). Use smooth easing curves. Make it feel alive and polished. Return the complete animated Lottie JSON.`;

          const llmResponse = await chatCompletion([
            { role: "system", content: systemPrompt },
            { role: "user", content: userMessage },
          ]);

          if (llmResponse.lottieJson && !llmResponse.parseError) {
            finalData = llmResponse.lottieJson;
            const replyText = llmResponse.reply || "Applied contextual animations to the imported SVG.";
            importMessage = `✨ Imported and animated **${name}** (${lottieObj.w}×${lottieObj.h}px, ${layers.length} layer${layers.length !== 1 ? "s" : ""}).\n\n${replyText}`;
            if (llmResponse.suggestions && llmResponse.suggestions.length > 0) {
              importMessage += `\n\n**Refinement suggestions:**\n${llmResponse.suggestions.map((s) => `- ${s}`).join("\n")}`;
            }
          } else {
            importMessage = `Imported SVG **${name}** — converted to Lottie (${lottieObj.w}×${lottieObj.h}px, ${layers.length} layer${layers.length !== 1 ? "s" : ""}). Auto-animation couldn't be applied. What would you like to animate?`;
          }
        } catch (err) {
          console.error("Auto-animate LLM error (import-url):", err);
          const lottieObj2 = data as Record<string, unknown>;
          importMessage = `Imported SVG **${name}** — converted to Lottie (${lottieObj2.w}×${lottieObj2.h}px, ${layers.length} layer${layers.length !== 1 ? "s" : ""}). Auto-animation unavailable. What would you like to animate?`;
        }
      } else {
        importMessage = `Imported SVG **${name}** — converted to Lottie (${lottieObj.w}×${lottieObj.h}px, 0 layers). This is a static frame ready for animation. What would you like to animate?`;
      }
    }

    const finalObj = finalData as Record<string, unknown>;
    const frameCount = finalObj.op ?? finalObj.totalFrames ?? null;
    const frameRate = finalObj.fr ?? 30;
    const durationSeconds = frameCount != null ? (frameCount as number) / (frameRate as number) : null;

    fs.writeFileSync(path.join(ANIMATIONS_DIR, `${id}.json`), JSON.stringify(finalData));

    db.prepare(
      "INSERT INTO animations (id, name, frame_count, duration_seconds) VALUES (?, ?, ?, ?)"
    ).run(id, name, frameCount, durationSeconds);

    // Save version record
    db.prepare(
      "INSERT INTO versions (animation_id, version_num, lottie_json, trigger_message) VALUES (?, ?, ?, ?)"
    ).run(id, 1, JSON.stringify(finalData), `URL import: ${name}`);

    // Seed an assistant message
    if (importMessage) {
      const messageId = randomUUID();
      db.prepare(
        "INSERT INTO messages (id, animation_id, role, content, lottie_json) VALUES (?, ?, 'assistant', ?, ?)"
      ).run(messageId, id, importMessage, JSON.stringify(finalData));
    }

    return Response.json({ id, name, message: importMessage }, { status: 201 });
  } catch (err) {
    console.error("Import URL error:", err);
    return Response.json(
      { error: err instanceof Error ? err.message : "Import failed" },
      { status: 500 }
    );
  }
}
