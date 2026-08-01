import { encodeSSE, createStreamingSSEResponse, sendDoneEvent } from "./helpers";

type ExportFormat = "gif" | "apng" | "video" | "json" | "dotlottie";

const FORMAT_LABELS: Record<ExportFormat, string> = {
  gif: "GIF",
  apng: "APNG",
  video: "video",
  json: "JSON",
  dotlottie: "dotLottie",
};

const FORMAT_EMOJI: Record<ExportFormat, string> = {
  gif: "🎬",
  apng: "🎞️",
  video: "🎥",
  json: "📄",
  dotlottie: "📦",
};

export function handleExport(format: ExportFormat, animationId: string | null | undefined): Response {
  if (!animationId) {
    return sendDoneEvent({ reply: "Cannot export — no animation is open. Create or load an animation first." });
  }

  const label = FORMAT_LABELS[format];
  const emoji = FORMAT_EMOJI[format];
  const message = `Exporting as ${label}... ${emoji}`;

  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encodeSSE(JSON.stringify({ type: "text", content: message })));
      controller.enqueue(encodeSSE(JSON.stringify({ type: "client_action", action: "export", format })));
      controller.enqueue(encodeSSE(JSON.stringify({ type: "done", reply: message })));
      controller.close();
    },
  });

  return createStreamingSSEResponse(stream);
}
