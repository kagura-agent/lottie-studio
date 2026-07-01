import { NextResponse } from "next/server";
import { chatCompletion } from "@/lib/llm";
import { buildSystemPrompt, buildDesignTokensPrompt } from "@/lib/prompts";
import { extractIp } from "@/lib/rateLimit";
import { validateGenerateInput } from "@/lib/generate-validation";

export const dynamic = "force-dynamic";

// ─── Separate rate limiter for /api/generate (stricter: 5 req/min) ───

const GENERATE_BURST = parseInt(process.env.GENERATE_RATE_BURST ?? "5", 10);
const GENERATE_WINDOW_SEC = parseInt(process.env.GENERATE_RATE_WINDOW_SEC ?? "60", 10);
const IS_PROD = process.env.NODE_ENV === "production";

interface Bucket {
  count: number;
  windowStart: number;
}

const globalForGenRate = globalThis as unknown as { __lottieGenRateBuckets?: Map<string, Bucket> };
const genBuckets = globalForGenRate.__lottieGenRateBuckets ?? (globalForGenRate.__lottieGenRateBuckets = new Map<string, Bucket>());

const LOCALHOST_IPS = new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1"]);

function checkGenerateRate(ip: string): { ok: true } | { ok: false; retryAfterSec: number } {
  if (LOCALHOST_IPS.has(ip)) return { ok: true };
  if (ip === "unknown" && !IS_PROD) return { ok: true };

  const now = Date.now();
  const windowMs = GENERATE_WINDOW_SEC * 1000;
  const bucket = genBuckets.get(ip);

  if (!bucket || now - bucket.windowStart >= windowMs) {
    genBuckets.set(ip, { count: 1, windowStart: now });
    return { ok: true };
  }

  if (bucket.count >= GENERATE_BURST) {
    const retryAfterSec = Math.ceil((bucket.windowStart + windowMs - now) / 1000);
    return { ok: false, retryAfterSec };
  }

  bucket.count++;
  return { ok: true };
}

// ─── POST handler ───

export async function POST(request: Request) {
  // Rate limiting
  const ip = extractIp(request);
  const rateResult = checkGenerateRate(ip);
  if (!rateResult.ok) {
    return NextResponse.json(
      { success: false, error: "Rate limit exceeded. Please try again later.", retryAfterSec: rateResult.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(rateResult.retryAfterSec) } }
    );
  }

  // Parse body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  // Validate input
  const validation = validateGenerateInput(body);
  if (!validation.valid) {
    return NextResponse.json(
      { success: false, error: validation.error },
      { status: 400 }
    );
  }

  const { prompt, width, height, duration, currentAnimation } = validation.data;
  const designTokens = (body as Record<string, unknown>).designTokens as { primary?: string; secondary?: string; accent?: string; background?: string; font?: string } | undefined;
  const fps = 30;
  const totalFrames = Math.round(duration * fps);

  // Build system prompt (pass currentAnimation if refining an existing animation)
  let systemPrompt = buildSystemPrompt(currentAnimation ?? null, prompt);

  // Inject design tokens into system prompt if provided
  if (designTokens) {
    const tokenPrompt = buildDesignTokensPrompt(designTokens);
    if (tokenPrompt) {
      systemPrompt += `\n\n${tokenPrompt}`;
    }
  }

  // Add dimension/duration overrides to system prompt
  const overrideNote = `\n\nIMPORTANT: Generate this animation with exactly these settings:
- Canvas size: ${width}×${height} pixels (set "w": ${width}, "h": ${height})
- Frame rate: ${fps} fps (set "fr": ${fps})
- Duration: ${duration} seconds = ${totalFrames} frames (set "ip": 0, "op": ${totalFrames})`;

  const messages = [
    { role: "system" as const, content: systemPrompt + overrideNote },
    { role: "user" as const, content: prompt },
  ];

  // Call LLM
  try {
    const result = await chatCompletion(messages);

    if (!result.lottieJson) {
      return NextResponse.json(
        { success: false, error: "Failed to generate animation. The AI did not produce valid Lottie JSON. Please try a different prompt." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      animation: result.lottieJson,
      description: result.reply,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[/api/generate] LLM error:", message);
    return NextResponse.json(
      { success: false, error: "Animation generation failed. Please try again." },
      { status: 500 }
    );
  }
}
