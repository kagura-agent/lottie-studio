import { db, ANIMATIONS_DIR } from "@/lib/db";
import { chatCompletion } from "@/lib/llm";
import { buildSystemPrompt } from "@/lib/prompts";
import { convertSvgToLottie } from "@/lib/svg-to-lottie";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export const dynamic = "force-dynamic";

/**
 * Describe the layers in the static Lottie for the LLM prompt.
 */
export function describeLayersForLLM(layers: unknown[]): string {
  const descriptions: string[] = [];
  for (let i = 0; i < layers.length; i++) {
    const layer = layers[i] as Record<string, unknown>;
    const name = (layer.nm as string) || `Layer ${i}`;
    const ty = layer.ty as number;
    const typeLabel =
      ty === 4 ? "Shape" : ty === 5 ? "Text" : ty === 0 ? "Precomp" : ty === 1 ? "Solid" : ty === 3 ? "Null" : `Type ${ty}`;
    descriptions.push(`- Layer ${i}: "${name}" (${typeLabel})`);
  }
  return descriptions.join("\n");
}

export async function POST(request: Request) {
  try {
    const url = new URL(request.url);
    const autoAnimate = url.searchParams.get("autoAnimate") !== "false";

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

    // Save animation
    const id = randomUUID();
    const data = lottieData as Record<string, unknown>;
    const layers = (data.layers as unknown[]) || [];

    // Attempt auto-animation via LLM
    let finalLottieData = lottieData;
    let importMessage: string;
    let suggestions: string[] | null = null;

    if (autoAnimate && layers.length > 0) {
      try {
        const systemPrompt = buildSystemPrompt(lottieData);
        const layerDescription = describeLayersForLLM(layers);
        const userMessage = `I just imported an SVG called "${filename}" which has been converted to a static Lottie with ${layers.length} layer${layers.length !== 1 ? "s" : ""}:\n\n${layerDescription}\n\nPlease analyze the layer structure and apply contextually appropriate animations. Add entrance animations (fade in, scale up, or slide in with staggered timing), and where appropriate, add subtle looping animations (gentle floating, pulsing, or rotation). Use smooth easing curves. Make it feel alive and polished. Return the complete animated Lottie JSON.`;

        const llmResponse = await chatCompletion([
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ]);

        if (llmResponse.lottieJson && !llmResponse.parseError) {
          finalLottieData = llmResponse.lottieJson;
          suggestions = llmResponse.suggestions;

          // Build a descriptive import message from LLM reply
          const replyText = llmResponse.reply || "Applied contextual animations to the imported SVG.";
          importMessage = `✨ Imported and animated **${filename}** (${data.w}×${data.h}px, ${layers.length} layer${layers.length !== 1 ? "s" : ""}).\n\n${replyText}`;
          if (suggestions && suggestions.length > 0) {
            importMessage += `\n\n**Refinement suggestions:**\n${suggestions.map((s) => `- ${s}`).join("\n")}`;
          }
        } else {
          // LLM failed to produce valid Lottie — fall back to static
          importMessage = `Imported SVG **${filename}** — converted to Lottie (${data.w}×${data.h}px, ${layers.length} layer${layers.length !== 1 ? "s" : ""}). Auto-animation couldn't be applied. What would you like to animate?`;
        }
      } catch (err) {
        // LLM call failed entirely — fall back to static
        console.error("Auto-animate LLM error:", err);
        importMessage = `Imported SVG **${filename}** — converted to Lottie (${data.w}×${data.h}px, ${layers.length} layer${layers.length !== 1 ? "s" : ""}). Auto-animation unavailable. What would you like to animate?`;
      }
    } else {
      // autoAnimate disabled or no layers
      importMessage = `Imported SVG **${filename}** — converted to Lottie (${data.w}×${data.h}px, ${layers.length} layer${layers.length !== 1 ? "s" : ""}). This is a static frame ready for animation. What would you like to animate?`;
    }

    // Use the final (possibly animated) lottie data for saving
    const finalData = finalLottieData as Record<string, unknown>;
    const frameCount = finalData.op as number;
    const frameRate = finalData.fr as number;
    const durationSeconds = frameCount / frameRate;

    fs.writeFileSync(path.join(ANIMATIONS_DIR, `${id}.json`), JSON.stringify(finalLottieData));

    db.prepare(
      "INSERT INTO animations (id, name, frame_count, duration_seconds) VALUES (?, ?, ?, ?)"
    ).run(id, filename, frameCount, durationSeconds);

    // Save version record
    db.prepare(
      "INSERT INTO versions (animation_id, version_num, lottie_json, trigger_message) VALUES (?, ?, ?, ?)"
    ).run(id, 1, JSON.stringify(finalLottieData), `SVG import: ${filename}`);

    // Seed an assistant message describing the import
    const messageId = randomUUID();
    db.prepare(
      "INSERT INTO messages (id, animation_id, role, content, lottie_json) VALUES (?, ?, 'assistant', ?, ?)"
    ).run(messageId, id, importMessage, JSON.stringify(finalLottieData));

    return Response.json({ id, name: filename, data: finalLottieData, message: importMessage }, { status: 201 });
  } catch (err) {
    console.error("Import SVG error:", err);
    return Response.json(
      { error: err instanceof Error ? err.message : "Import failed" },
      { status: 500 }
    );
  }
}
