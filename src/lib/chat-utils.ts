import { detectUndoIntent } from "@/lib/undo-intent";

/**
 * Detect if a user message is an undo/revert/redo intent.
 */
export function isUndoIntent(message: string): boolean {
  return detectUndoIntent(message) !== null;
}

export interface MessageRow {
  id: string;
  animation_id: string;
  role: "user" | "assistant";
  content: string;
  lottie_json: string | null;
  image_url: string | null;
  created_at: string;
}

export const HISTORY_CAP = 20;
export const LOTTIE_CODE_BLOCK_RE = /```json\n[\s\S]*?```/g;

/**
 * Compact conversation history to reduce token usage:
 * 1. Cap to the most recent HISTORY_CAP messages
 * 2. Strip Lottie JSON code blocks from all assistant messages except the last
 * 3. Strip base64 image data URLs from all user messages except the most recent with an image
 */
export function compactHistory(messages: MessageRow[]): MessageRow[] {
  // 1. Cap history
  const capped = messages.length > HISTORY_CAP
    ? messages.slice(-HISTORY_CAP)
    : [...messages];

  // Find the last assistant message index (to preserve its code blocks)
  let lastAssistantIdx = -1;
  for (let i = capped.length - 1; i >= 0; i--) {
    if (capped[i].role === "assistant") {
      lastAssistantIdx = i;
      break;
    }
  }

  // Find the last user message with an image (to preserve its data URL)
  let lastImageIdx = -1;
  for (let i = capped.length - 1; i >= 0; i--) {
    if (capped[i].role === "user" && capped[i].image_url) {
      lastImageIdx = i;
      break;
    }
  }

  return capped.map((m, i) => {
    const copy = { ...m };

    // 2. Strip Lottie JSON code blocks from older assistant messages
    if (copy.role === "assistant" && i !== lastAssistantIdx) {
      copy.content = copy.content.replace(LOTTIE_CODE_BLOCK_RE, "[animation updated]");
    }

    // 3. Strip image data URLs from older user messages
    if (copy.role === "user" && copy.image_url && i !== lastImageIdx) {
      copy.image_url = null;
      if (!copy.content.includes("[image attached]")) {
        copy.content = `[image attached] ${copy.content}`;
      }
    }

    return copy;
  });
}
