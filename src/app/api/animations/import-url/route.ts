import { db, ANIMATIONS_DIR } from "@/lib/db";
import { convertSvgToLottie } from "@/lib/svg-to-lottie";
import { chatCompletion } from "@/lib/llm";
import { buildAutoAnimatePrompt } from "@/lib/prompts";
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
    return filename.replace(/\.(json|lottie|svg)$/i, "");
  } catch {
    return "Imported Animation";
  }
}

function describeLayerStructure(layers: unknown[]): string {
  return layers
    .map((layer, idx) => {
      const l = layer as Record<string, unknown>;
      const name = (l.nm as string) || `Layer ${idx}`;
      const shapes = l.shapes as unknown[] | undefined;
      let shapeInfo = "";
      if (shapes && Array.isArray(shapes)) {
        const types = shapes.map((s) => {
          const sh = s as Record<string, unknown>;
          return sh.ty === "gr" ? "group" : String(sh.ty || "unknown");
        });
        shapeInfo = ` (shapes: ${types.join(", ")})`;
      }
      return `- Layer ${idx}: "${name}" [type ${l.ty}]${shapeInfo}`;
    })
    .join("\n");
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

    // SVG detection: content-type or content contains <svg
    const textContent = new TextDecoder().decode(buffer);
    const isSvg = contentType.includes("svg") || textContent.includes("<svg");

    if (isSvg) {
      // Convert SVG to Lottie
      let lottieData: object;
      try {
        const result = convertSvgToLottie(textContent);
        lottieData = result.data;
      } catch (err) {
        return Response.json(
          { error: err instanceof Error ? err.message : "SVG conversion failed" },
          { status: 400 }
        );
      }

      name = extractNameFromUrl(url);
      const lottie = lottieData as Record<string, unknown>;
      const layers = (lottie.layers as unknown[]) || [];
      const w = lottie.w as number;
      const h = lottie.h as number;
      const op = lottie.op as number;

      // Auto-animate: invoke LLM to add animations to the static Lottie
      let animatedData = lottieData;
      let wasAutoAnimated = false;
      let animationDescription = "";

      if (layers.length > 0) {
        try {
          const layerInfo = describeLayerStructure(layers);
          const systemPrompt = buildAutoAnimatePrompt(layerInfo, { w, h, frames: op });

          const messages: { role: "system" | "user"; content: string }[] = [
            { role: "system", content: systemPrompt },
            {
              role: "user",
              content: `Here is the static Lottie JSON to animate:\n\n\`\`\`json\n${JSON.stringify(lottieData)}\n\`\`\`\n\nAdd appropriate entrance animations and subtle motion to bring this design to life.`,
            },
          ];

          const llmResponse = await chatCompletion(messages);

          if (llmResponse.lottieJson) {
            animatedData = llmResponse.lottieJson;
            wasAutoAnimated = true;
            animationDescription = llmResponse.reply || "";
          }
        } catch (err) {
          // LLM call failed — fall back to static import silently
          console.warn("Auto-animate LLM call failed, using static import:", err);
        }
      }

      // Save animation
      const id = randomUUID();
      const finalData = animatedData as Record<string, unknown>;
      const frameCount = (finalData.op as number) ?? op;
      const frameRate = (finalData.fr as number) ?? 30;
      const durationSeconds = frameCount / frameRate;

      fs.writeFileSync(path.join(ANIMATIONS_DIR, `${id}.json`), JSON.stringify(animatedData));

      db.prepare(
        "INSERT INTO animations (id, name, frame_count, duration_seconds) VALUES (?, ?, ?, ?)"
      ).run(id, name, frameCount, durationSeconds);

      // Seed a chat message describing the import
      let importMessage: string;
      if (wasAutoAnimated) {
        const layerCount = (finalData.layers as unknown[])?.length || layers.length;
        importMessage = `Imported and auto-animated SVG **${name}** from URL (${w}×${h}px, ${layerCount} layer${layerCount !== 1 ? "s" : ""}).`;
        if (animationDescription) {
          importMessage += `\n\n${animationDescription}`;
        } else {
          importMessage += `\n\nI've added entrance animations and subtle motion to your design. Each layer animates in with staggered timing for a polished feel.`;
        }
        importMessage += `\n\n💡 **Suggestions:**\n- "Make the animations more bouncy"\n- "Slow down the entrance"\n- "Add a looping pulse to the main element"\n- "Remove all animations and start fresh"`;
      } else {
        importMessage = `Imported SVG **${name}** from URL — converted to Lottie (${w}×${h}px, ${layers.length} layer${layers.length !== 1 ? "s" : ""}). This is a static frame ready for animation. What would you like to animate?`;
      }

      const messageId = randomUUID();
      db.prepare(
        "INSERT INTO messages (id, animation_id, role, content) VALUES (?, ?, 'assistant', ?)"
      ).run(messageId, id, importMessage);

      return Response.json({ id, name, data: animatedData, autoAnimated: wasAutoAnimated }, { status: 201 });
    }

    // Try to parse as zip first if content-type suggests it or if it's a .lottie URL
    if (
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
    const frameCount = (data as Record<string, unknown>).op ?? (data as Record<string, unknown>).totalFrames ?? null;
    const frameRate = (data as Record<string, unknown>).fr ?? 30;
    const durationSeconds = frameCount != null ? (frameCount as number) / (frameRate as number) : null;

    fs.writeFileSync(path.join(ANIMATIONS_DIR, `${id}.json`), JSON.stringify(data));

    db.prepare(
      "INSERT INTO animations (id, name, frame_count, duration_seconds) VALUES (?, ?, ?, ?)"
    ).run(id, name, frameCount, durationSeconds);

    return Response.json({ id, name }, { status: 201 });
  } catch (err) {
    console.error("Import URL error:", err);
    return Response.json(
      { error: err instanceof Error ? err.message : "Import failed" },
      { status: 500 }
    );
  }
}
