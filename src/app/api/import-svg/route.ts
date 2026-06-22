import { db, ANIMATIONS_DIR } from "@/lib/db";
import { convertSvgToLottie } from "@/lib/svg-to-lottie";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
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
    const frameCount = data.op as number;
    const frameRate = data.fr as number;
    const durationSeconds = frameCount / frameRate;

    fs.writeFileSync(path.join(ANIMATIONS_DIR, `${id}.json`), JSON.stringify(lottieData));

    db.prepare(
      "INSERT INTO animations (id, name, frame_count, duration_seconds) VALUES (?, ?, ?, ?)"
    ).run(id, filename, frameCount, durationSeconds);

    // Seed an assistant message describing the import
    const layers = (data.layers as unknown[]) || [];
    const importMessage = `Imported SVG **${filename}** — converted to Lottie (${data.w}×${data.h}px, ${layers.length} layer${layers.length !== 1 ? "s" : ""}). This is a static frame ready for animation. What would you like to animate?`;

    const messageId = randomUUID();
    db.prepare(
      "INSERT INTO messages (id, animation_id, role, content) VALUES (?, ?, 'assistant', ?)"
    ).run(messageId, id, importMessage);

    return Response.json({ id, name: filename, data: lottieData }, { status: 201 });
  } catch (err) {
    console.error("Import SVG error:", err);
    return Response.json(
      { error: err instanceof Error ? err.message : "Import failed" },
      { status: 500 }
    );
  }
}
