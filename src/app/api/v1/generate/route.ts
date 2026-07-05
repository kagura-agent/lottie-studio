import crypto from "node:crypto";
import { authenticateRequest } from "@/lib/apiAuth";
import { checkApiRate } from "@/lib/rateLimiter";
import { chatCompletion } from "@/lib/llm";
import { buildSystemPrompt } from "@/lib/prompts";
import { validateGenerateInput } from "@/lib/generate-validation";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  // Auth
  const auth = authenticateRequest(request);
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  // Rate limit
  const rate = checkApiRate(auth.keyId, auth.rateLimit);
  if (!rate.ok) {
    return Response.json(
      { error: "Rate limit exceeded" },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSec) } }
    );
  }

  // Parse body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Validate input
  const validation = validateGenerateInput(body);
  if (!validation.valid) {
    return Response.json({ error: validation.error }, { status: 400 });
  }

  const { prompt, width, height, duration } = validation.data;
  const fps = 30;
  const totalFrames = Math.round(duration * fps);

  const systemPrompt = buildSystemPrompt(null, prompt);
  const overrideNote = `\n\nIMPORTANT: Generate this animation with exactly these settings:
- Canvas size: ${width}×${height} pixels (set "w": ${width}, "h": ${height})
- Frame rate: ${fps} fps (set "fr": ${fps})
- Duration: ${duration} seconds = ${totalFrames} frames (set "ip": 0, "op": ${totalFrames})`;

  const messages = [
    { role: "system" as const, content: systemPrompt + overrideNote },
    { role: "user" as const, content: prompt },
  ];

  try {
    const result = await chatCompletion(messages);

    if (!result.lottieJson) {
      return Response.json(
        { error: "Failed to generate animation. Please try a different prompt." },
        { status: 500 }
      );
    }

    return Response.json({
      id: crypto.randomUUID(),
      lottieJson: result.lottieJson,
      description: result.reply,
    });
  } catch (err) {
    console.error("[/api/v1/generate] LLM error:", err instanceof Error ? err.message : err);
    return Response.json(
      { error: "Animation generation failed. Please try again." },
      { status: 500 }
    );
  }
}
