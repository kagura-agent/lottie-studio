/**
 * Extract a clean, concise animation title from the user's first chat message.
 *
 * Strips conversational prefixes/suffixes and title-cases the result.
 * Falls back to a truncated version of the original message if extraction
 * produces an empty string.
 */

const MAX_TITLE_LENGTH = 50;

// English prefixes to strip (order matters: longer/more specific first)
const EN_PREFIXES = [
  "can you please make me",
  "can you please create",
  "can you please make",
  "could you please make",
  "could you please create",
  "can you make me",
  "can you create me",
  "please make me",
  "please create me",
  "can you make",
  "can you create",
  "could you make",
  "could you create",
  "please make",
  "please create",
  "please draw",
  "please generate",
  "please design",
  "please build",
  "please animate",
  "i would like",
  "i'd like",
  "let me see",
  "show me",
  "how about",
  "what about",
  "give me",
  "make me",
  "i want",
  "i need",
  "create",
  "make",
  "build",
  "design",
  "generate",
  "draw",
  "animate",
];

// Chinese prefixes to strip (order matters: longer first)
const ZH_PREFIXES = [
  "帮我创建一个",
  "帮我生成一个",
  "请帮我做一个",
  "请帮我画一个",
  "帮我做一个",
  "帮我画一个",
  "帮我创建",
  "帮我生成",
  "生成一个",
  "创建一个",
  "帮我做个",
  "帮我画个",
  "请做一个",
  "请画一个",
  "我想要一个",
  "来一个",
  "做一个",
  "画一个",
  "弄一个",
  "搞一个",
  "给我做",
  "给我画",
  "我想要",
  "帮我做",
  "帮我画",
  "请做",
  "请画",
  "做个",
  "画个",
  "弄个",
  "搞个",
];

// Trailing filler to strip
const EN_SUFFIXES = [
  "for me please",
  "for me thanks",
  "for me thank you",
  "please thanks",
  "for me",
  "please",
  "thanks",
  "thank you",
];

const ZH_SUFFIXES = [
  "谢谢",
  "可以吗",
  "好吗",
  "吧",
  "呗",
  "啊",
];

// Leading articles to strip after prefix removal
const ARTICLES = ["a ", "an ", "the "];

/**
 * Detect if the text is primarily CJK (Chinese/Japanese/Korean).
 */
function isCJK(text: string): boolean {
  const cjkChars = text.match(/[\u4e00-\u9fff\u3400-\u4dbf\u3000-\u303f\u3040-\u309f\u30a0-\u30ff]/g);
  return !!cjkChars && cjkChars.length > text.length * 0.3;
}

/**
 * Title-case English text (capitalize first letter of each word).
 * Preserves small words in the middle (of, the, a, an, in, on, for, with, and, or, but)
 * unless they're the first word.
 */
function titleCase(text: string): string {
  const smallWords = new Set(["of", "the", "a", "an", "in", "on", "for", "with", "and", "or", "but", "to", "is", "at", "by"]);

  return text
    .split(/\s+/)
    .map((word, index) => {
      if (index === 0 || !smallWords.has(word.toLowerCase())) {
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
      }
      return word.toLowerCase();
    })
    .join(" ");
}

/**
 * Truncate text at word boundary, respecting MAX_TITLE_LENGTH.
 */
function truncateAtWordBoundary(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;

  // For CJK text, just cut at max length (no word boundaries)
  if (isCJK(text)) {
    return text.slice(0, maxLen);
  }

  // Find the last space before maxLen
  const truncated = text.slice(0, maxLen);
  const lastSpace = truncated.lastIndexOf(" ");

  if (lastSpace > maxLen * 0.5) {
    return truncated.slice(0, lastSpace);
  }

  // If no good word boundary, just truncate
  return truncated;
}

export function extractTitle(message: string): string {
  let text = message.trim();

  if (!text) return "Untitled";

  const lower = text.toLowerCase();

  // Strip English prefixes
  for (const prefix of EN_PREFIXES) {
    if (lower.startsWith(prefix + " ") || lower.startsWith(prefix + ":")) {
      text = text.slice(prefix.length).trimStart();
      // Remove leading colon/dash if present
      if (text.startsWith(":") || text.startsWith("-") || text.startsWith("—")) {
        text = text.slice(1).trimStart();
      }
      break;
    }
    if (lower === prefix) {
      // The entire message is just the prefix (edge case)
      return "Untitled";
    }
  }

  // Strip Chinese prefixes
  for (const prefix of ZH_PREFIXES) {
    if (text.startsWith(prefix)) {
      text = text.slice(prefix.length).trimStart();
      break;
    }
  }

  // Strip trailing filler (English)
  const lowerAfter = text.toLowerCase();
  for (const suffix of EN_SUFFIXES) {
    if (lowerAfter.endsWith(" " + suffix) || lowerAfter.endsWith("," + suffix) || lowerAfter.endsWith(", " + suffix)) {
      // Find the suffix position and trim
      const suffixStart = text.length - suffix.length;
      let cutPoint = suffixStart;
      // Also remove trailing comma/space before the suffix
      while (cutPoint > 0 && (text[cutPoint - 1] === " " || text[cutPoint - 1] === ",")) {
        cutPoint--;
      }
      text = text.slice(0, cutPoint).trimEnd();
      break;
    }
  }

  // Strip trailing filler (Chinese)
  for (const suffix of ZH_SUFFIXES) {
    if (text.endsWith(suffix)) {
      text = text.slice(0, -suffix.length).trimEnd();
      break;
    }
  }

  // Strip leading articles (English only, after prefix removal)
  if (!isCJK(text)) {
    const textLower = text.toLowerCase();
    for (const article of ARTICLES) {
      if (textLower.startsWith(article)) {
        text = text.slice(article.length);
        break;
      }
    }
  }

  // Clean up whitespace
  text = text.replace(/\s+/g, " ").trim();

  // If nothing left, fall back
  if (!text) return message.slice(0, MAX_TITLE_LENGTH).trim() || "Untitled";

  // Title-case for English; leave CJK as-is
  if (!isCJK(text)) {
    text = titleCase(text);
  }

  // Truncate at word boundary
  text = truncateAtWordBoundary(text, MAX_TITLE_LENGTH);

  return text || "Untitled";
}

export default extractTitle;
