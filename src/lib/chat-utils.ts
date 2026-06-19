/**
 * Detect if a user message is an undo/revert intent.
 * Conservative: short messages (≤5 words) that are clearly requesting undo.
 * False negatives preferred over false positives.
 */
export function isUndoIntent(message: string): boolean {
  const normalized = message.trim().toLowerCase();
  if (!normalized) return false;

  // Exact matches (including Chinese)
  const exactMatches = [
    "undo", "revert", "go back", "undo that",
    "undo last change", "revert to previous", "undo last",
    "撤销", "回退", "撤回",
  ];
  if (exactMatches.includes(normalized)) return true;

  // Short messages starting with undo/revert keywords
  const words = normalized.split(/\s+/);
  if (words.length > 5) return false;

  // "go back" variants (e.g. "go back one step")
  if (normalized.startsWith("go back")) return true;

  // "undo" or "revert" as the entire message or with simple suffixes
  // but NOT "undo the rotation" style (modification requests)
  if (words.length <= 3 && (words[0] === "undo" || words[0] === "revert")) {
    // Block if it looks like a modification request (has a noun/object that isn't generic)
    const genericSuffixes = ["that", "this", "it", "last", "please", "pls"];
    if (words.length === 1) return true;
    if (words.length === 2 && genericSuffixes.includes(words[1])) return true;
    if (words.length === 3 && words[1] === "last" && ["change", "edit", "step", "one"].includes(words[2])) return true;
    return false;
  }

  return false;
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
