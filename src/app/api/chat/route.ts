import { isUndoIntent } from "@/lib/chat-utils";
import { extractIp, checkRate } from "@/lib/rateLimit";
import { parseCommand } from "@/lib/commands";
import {
  handleUndo,
  handleCompose,
  handleLayerCommand,
  handleCritique,
  handleFix,
  handlePolish,
  handlePresetCommand,
  handleRetime,
  handleA11y,
  handleTrim,
  handleMirror,
  handleRotate,
  handleScale,
  handleColor,
  handleEasing,
  handleStagger,
  handleMorph,
  handleMainChat,
  sendDoneEvent,
  animationExists,
} from "@/lib/chat-handlers";

export const dynamic = "force-dynamic";

function extractLocale(request: Request): string | undefined {
  const cookie = request.headers.get("cookie");
  if (cookie) {
    const match = cookie.match(/(?:^|;\s*)NEXT_LOCALE=([^;]+)/);
    if (match) return match[1];
  }

  const acceptLang = request.headers.get("accept-language");
  if (acceptLang) {
    const primary = acceptLang.split(",")[0].trim().split(";")[0].trim();
    if (primary) return primary;
  }

  return undefined;
}

interface ChatRequest {
  animationId?: string;
  message: string;
  image?: string;
  regenerate?: boolean;
  designTokens?: { primary?: string; secondary?: string; accent?: string; background?: string; font?: string };
  layerContext?: { name: string; type: string; index: number; inPoint?: number; outPoint?: number; position?: unknown; opacity?: unknown; scale?: unknown; rotation?: unknown };
}

export async function POST(request: Request) {
  const ip = extractIp(request);
  const rate = checkRate(ip);
  if (!rate.ok) {
    return new Response(
      JSON.stringify({ error: "Too many requests, slow down 🌸", retryAfterSec: rate.retryAfterSec }),
      { status: 429, headers: { "Content-Type": "application/json", "Retry-After": String(rate.retryAfterSec) } }
    );
  }

  const body: ChatRequest = await request.json();
  const { message } = body;
  const { animationId } = body;

  if (!message?.trim()) {
    return Response.json({ error: "message is required" }, { status: 400 });
  }

  // --- Undo intent ---
  if (isUndoIntent(message)) {
    if (!animationId) {
      return sendDoneEvent({ reply: "Cannot undo — no saved animation to revert." });
    }
    if (!animationExists(animationId)) {
      return Response.json({ error: "Animation not found" }, { status: 404 });
    }
    return handleUndo(animationId, message);
  }

  // --- Command dispatch ---
  const parsedCmd = parseCommand(message);

  if (parsedCmd && parsedCmd.type === "compose") {
    if (!animationId) {
      return sendDoneEvent({ reply: "Cannot compose — no current animation to compose into. Create an animation first." });
    }
    if (!animationExists(animationId)) {
      return Response.json({ error: "Animation not found" }, { status: 404 });
    }
    return handleCompose(animationId, parsedCmd.id, message);
  }

  if (parsedCmd && (parsedCmd.type === "layers" || parsedCmd.type === "duplicate_layer" || parsedCmd.type === "delete_layer" || parsedCmd.type === "rename_layer")) {
    return handleLayerCommand(parsedCmd as Parameters<typeof handleLayerCommand>[0], animationId, message);
  }

  if (parsedCmd && parsedCmd.type === "critique") {
    return handleCritique(animationId, message);
  }

  if (parsedCmd && parsedCmd.type === "fix") {
    return handleFix(animationId, message);
  }

  if (parsedCmd && parsedCmd.type === "polish") {
    return handlePolish(animationId, message);
  }

  if (parsedCmd && parsedCmd.type === "a11y") {
    return handleA11y(animationId, message);
  }

  if (parsedCmd && parsedCmd.type === "duration") {
    return handleRetime(animationId, parsedCmd.durationMs, message);
  }

  if (parsedCmd && parsedCmd.type === "trim") {
    return handleTrim(animationId, parsedCmd.range, message);
  }

  if (parsedCmd && (parsedCmd.type === "mirror_h" || parsedCmd.type === "mirror_v")) {
    const axis = parsedCmd.type === "mirror_h" ? "horizontal" : "vertical";
    return handleMirror(animationId, axis, message);
  }

  if (parsedCmd && parsedCmd.type === "rotate") {
    return handleRotate(animationId, parsedCmd.degrees, message);
  }

  if (parsedCmd && parsedCmd.type === "scale") {
    return handleScale(animationId, parsedCmd.factor, message);
  }

  if (parsedCmd && parsedCmd.type === "color") {
    return handleColor(animationId, parsedCmd.subcommand, message);
  }

  if (parsedCmd && parsedCmd.type === "easing") {
    return handleEasing(animationId, parsedCmd.preset, message);
  }

  if (parsedCmd && parsedCmd.type === "stagger") {
    return handleStagger(animationId, parsedCmd.delayMs, parsedCmd.order, message);
  }

  if (parsedCmd && parsedCmd.type === "morph") {
    return handleMorph(animationId, parsedCmd.shape, parsedCmd.options, message);
  }

  if (parsedCmd && parsedCmd.type === "presets") {
    return handlePresetCommand(parsedCmd, animationId, request);
  }

  // --- Main LLM streaming flow ---
  const locale = extractLocale(request);
  return handleMainChat(request, body, animationId, locale, parsedCmd);
}
