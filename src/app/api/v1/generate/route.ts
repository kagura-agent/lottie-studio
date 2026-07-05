import { NextResponse } from "next/server";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { withApiKey } from "@/lib/api-middleware";
import { chatCompletion } from "@/lib/llm";
import { buildSystemPrompt } from "@/lib/prompts";
import { db, ANIMATIONS_DIR } from "@/lib/db";

export const dynamic = "force-dynamic";

export const POST = withApiKey(async ({ request }) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { prompt, width, height } = body as Record<string, unknown>;

  if (!prompt || typeof prompt !== "string" || prompt.trim().length === 0) {
    return NextResponse.json({ error: "prompt is required" }, { status: 400 });
  }

  const w = typeof width === "number" ? Math.min(2048, Math.max(64, width)) : 512;
  const h = typeof height === "number" ? Math.min(2048, Math.max(64, height)) : 512;
  const fps = 30;
  const duration = 2;
  const totalFrames = fps * duration;

  const systemPrompt = buildSystemPrompt(null, prompt as string);
  const overrideNote = `\n\nIMPORTANT: Generate this animation with exactly these settings:
- Canvas size: ${w}×${h} pixels (set "w": ${w}, "h": ${h})
- Frame rate: ${fps} fps (set "fr": ${fps})
- Duration: ${duration} seconds = ${totalFrames} frames (set "ip": 0, "op": ${totalFrames})`;

  const messages = [
    { role: "system" as const, content: systemPrompt + overrideNote },
    { role: "user" as const, content: prompt as string },
  ];

  try {
    const result = await chatCompletion(messages);

    if (!result.lottieJson) {
      return NextResponse.json(
        { error: "Failed to generate valid Lottie animation" },
        { status: 500 }
      );
    }

    const id = crypto.randomUUID();
    const animName = (prompt as string).slice(0, 100);

    db.prepare(
      "INSERT INTO animations (id, name, frame_count, duration_seconds) VALUES (?, ?, ?, ?)"
    ).run(id, animName, totalFrames, duration);

    const jsonPath = path.join(ANIMATIONS_DIR, `${id}.json`);
    fs.writeFileSync(jsonPath, JSON.stringify(result.lottieJson));

    return NextResponse.json({
      id,
      lottieJson: result.lottieJson,
      description: result.reply,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[/api/v1/generate] LLM error:", message);
    return NextResponse.json(
      { error: "Animation generation failed" },
      { status: 500 }
    );
  }
});
