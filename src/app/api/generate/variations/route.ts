import { NextResponse } from "next/server";
import { chatCompletion } from "@/lib/llm";
import { buildSystemPrompt } from "@/lib/prompts";
import { extractIp } from "@/lib/rateLimit";
import { validateGenerateInput } from "@/lib/generate-validation";

export const dynamic = "force-dynamic";

// ─── Rate limiter for /api/generate/variations (counts as 3 requests) ───

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

function checkGenerateRate(ip: string, cost: number): { ok: true } | { ok: false; retryAfterSec: number } {
  if (LOCALHOST_IPS.has(ip)) return { ok: true };
  if (ip === "unknown" && !IS_PROD) return { ok: true };

  const now = Date.now();
  const windowMs = GENERATE_WINDOW_SEC * 1000;
  const bucket = genBuckets.get(ip);

  if (!bucket || now - bucket.windowStart >= windowMs) {
    genBuckets.set(ip, { count: cost, windowStart: now });
    return { ok: true };
  }

  if (bucket.count + cost > GENERATE_BURST) {
    const retryAfterSec = Math.ceil((bucket.windowStart + windowMs - now) / 1000);
    return { ok: false, retryAfterSec };
  }

  bucket.count += cost;
  return { ok: true };
}

// ─── Style modifiers ───

const STYLE_MODIFIERS: Record<string, string> = {
  playful: `Style: PLAYFUL — Use elastic easing with overshoot on all movements. Choose bright, saturated colors (hot pink, electric blue, sunshine yellow). Add bouncy anticipation and follow-through. Shapes should feel energetic and fun with slight exaggeration.`,
  smooth: `Style: SMOOTH — Use gentle ease-in-out curves on all movements. Choose muted, sophisticated tones (soft grays, dusty blues, warm beiges). Keep shapes clean and geometric with minimal complexity. Timing should feel calm and flowing.`,
  dynamic: `Style: DYNAMIC — Use fast timing with sharp acceleration. Choose high-contrast colors (black/white, deep navy/bright orange). Include multiple animated elements with staggered timing. Movements should feel impactful and bold with strong directional motion.`,
};

type StyleKey = keyof typeof STYLE_MODIFIERS;

// ─── POST handler ───

export async function POST(request: Request) {
  // Rate limiting — variations count as 3 requests
  const ip = extractIp(request);
  const rateResult = checkGenerateRate(ip, 3);
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

  const { prompt, width, height, duration } = validation.data;
  const fps = 30;
  const totalFrames = Math.round(duration * fps);

  const baseSystemPrompt = buildSystemPrompt(null, prompt);
  const overrideNote = `\n\nIMPORTANT: Generate this animation with exactly these settings:
- Canvas size: ${width}×${height} pixels (set "w": ${width}, "h": ${height})
- Frame rate: ${fps} fps (set "fr": ${fps})
- Duration: ${duration} seconds = ${totalFrames} frames (set "ip": 0, "op": ${totalFrames})`;

  // Generate 3 variations in parallel
  const styles: StyleKey[] = ["playful", "smooth", "dynamic"];

  const results = await Promise.allSettled(
    styles.map((style) => {
      const styledSystemPrompt = baseSystemPrompt + overrideNote + `\n\n${STYLE_MODIFIERS[style]}`;
      const messages = [
        { role: "system" as const, content: styledSystemPrompt },
        { role: "user" as const, content: prompt },
      ];
      return chatCompletion(messages);
    })
  );

  // Collect successful variations
  const variations: { style: string; animation: object; description: string }[] = [];

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    if (result.status === "fulfilled" && result.value.lottieJson) {
      variations.push({
        style: styles[i],
        animation: result.value.lottieJson,
        description: result.value.reply,
      });
    }
  }

  if (variations.length === 0) {
    return NextResponse.json(
      { success: false, error: "All variations failed to generate. Please try a different prompt." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    variations,
  });
}
