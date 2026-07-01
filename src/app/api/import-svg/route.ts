import { db, ANIMATIONS_DIR } from "@/lib/db";
import { convertSvgToLottie } from "@/lib/svg-to-lottie";
import { chatCompletion } from "@/lib/llm";
import { buildAutoAnimatePrompt } from "@/lib/prompts";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export const dynamic = "force-dynamic";

/**
 * Summarize layer structure for the LLM prompt.
 */
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
    const url = new URL(request.url);
    // Default autoAnimate to true; can be disabled via query param or JSON body
    let autoAnimate = url.searchParams.get("autoAnimate") !== "false";

    const contentType = request.headers.get("content-type") || "";

    let svgText: string;
    let filename = "Imported SVG";

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("file") as File | null;

      if (!file) {
        return Response.json({ error: "No file provided" }, { status: 400 });
      }

      if (file.size > 5 * 1024 * 1024) {
        return Response.json({ error: "File too large (max 5MB)" }, { status: 413 });
      }

      filename = file.name.replace(/\.svg$/i, "") || "Imported SVG";
      svgText = await file.text();
    } else {
      // Accept raw JSON body with svg string
      const body = await request.json();
      if (!body.svg || typeof body.svg !== "string") {
        return Response.json({ error: "svg field is required" }, { status: 400 });
      }
      svgText = body.svg;
      if (body.name) filename = body.name;
      // Allow autoAnimate to be set via body field
      if (body.autoAnimate === false) {
        autoAnimate = false;
      }
    }

    // Basic validation: must contain <svg
    if (!svgText.includes("<svg")) {
      return Response.json({ error: "Invalid SVG: missing <svg> element" }, { status: 400 });
    }

    // Convert SVG to Lottie
    let lottieData: object;
    try {
      const result = convertSvgToLottie(svgText);
      lottieData = result.data;
    } catch (err) {
      return Response.json(
        { error: err instanceof Error ? err.message : "SVG conversion failed" },
        { status: 400 }
      );
    }

    const data = lottieData as Record<string, unknown>;
    const layers = (data.layers as unknown[]) || [];
    const w = data.w as number;
    const h = data.h as number;
    const op = data.op as number;

    // Auto-animate: invoke LLM to add animations to the static Lottie
    let animatedData = lottieData;
    let animationDescription = "";
    let wasAutoAnimated = false;

    if (autoAnimate && layers.length > 0) {
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
    const frameCount = finalData.op as number;
    const frameRate = finalData.fr as number;
    const durationSeconds = frameCount / frameRate;

    fs.writeFileSync(path.join(ANIMATIONS_DIR, `${id}.json`), JSON.stringify(animatedData));

    db.prepare(
      "INSERT INTO animations (id, name, frame_count, duration_seconds) VALUES (?, ?, ?, ?)"
    ).run(id, filename, frameCount, durationSeconds);

    // Seed an assistant message describing the import
    let importMessage: string;

    if (wasAutoAnimated) {
      const layerCount = (finalData.layers as unknown[])?.length || layers.length;
      importMessage = `Imported and auto-animated SVG **${filename}** (${w}×${h}px, ${layerCount} layer${layerCount !== 1 ? "s" : ""}).`;

      if (animationDescription) {
        importMessage += `\n\n${animationDescription}`;
      } else {
        importMessage += `\n\nI've added entrance animations and subtle motion to your design. Each layer animates in with staggered timing for a polished feel.`;
      }

      importMessage += `\n\n💡 **Suggestions:**\n- "Make the animations more bouncy"\n- "Slow down the entrance"\n- "Add a looping pulse to the main element"\n- "Remove all animations and start fresh"`;
    } else {
      importMessage = `Imported SVG **${filename}** — converted to Lottie (${w}×${h}px, ${layers.length} layer${layers.length !== 1 ? "s" : ""}). This is a static frame ready for animation. What would you like to animate?`;
    }

    const messageId = randomUUID();
    db.prepare(
      "INSERT INTO messages (id, animation_id, role, content) VALUES (?, ?, 'assistant', ?)"
    ).run(messageId, id, importMessage);

    return Response.json({ id, name: filename, data: animatedData, autoAnimated: wasAutoAnimated }, { status: 201 });
  } catch (err) {
    console.error("Import SVG error:", err);
    return Response.json(
      { error: err instanceof Error ? err.message : "Import failed" },
      { status: 500 }
    );
  }
}
