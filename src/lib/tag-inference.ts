/**
 * Tag inference utility for auto-categorizing animations.
 * Uses keyword matching against user prompt text to assign 1-3 tags
 * from a predefined vocabulary.
 */

export const TAG_VOCABULARY = [
  "loading",
  "text",
  "logo",
  "icon",
  "nature",
  "abstract",
  "geometric",
  "character",
  "transition",
  "ui-element",
  "celebration",
  "notification",
] as const;

export type AnimationTag = (typeof TAG_VOCABULARY)[number];

interface TagRule {
  tag: AnimationTag;
  keywords: string[];
}

const TAG_RULES: TagRule[] = [
  {
    tag: "loading",
    keywords: ["spinner", "loading", "progress", "dots"],
  },
  {
    tag: "text",
    keywords: ["text", "typography", "title", "heading", "word"],
  },
  {
    tag: "logo",
    keywords: ["logo", "brand"],
  },
  {
    tag: "icon",
    keywords: ["icon", "button", "ui"],
  },
  {
    tag: "nature",
    keywords: [
      "flower", "tree", "leaf", "sun", "moon", "star", "cloud",
      "rain", "water", "wave", "sakura", "petal", "wind",
    ],
  },
  {
    tag: "abstract",
    keywords: ["abstract"],
  },
  {
    tag: "geometric",
    keywords: ["circle", "square", "triangle", "polygon", "pattern", "grid"],
  },
  {
    tag: "character",
    keywords: ["face", "person", "animal", "cat", "dog", "bird"],
  },
  {
    tag: "transition",
    keywords: ["transition", "slide", "fade", "wipe", "reveal"],
  },
  {
    tag: "ui-element",
    keywords: ["toggle", "switch", "checkbox", "menu", "notification", "badge"],
  },
  {
    tag: "celebration",
    keywords: ["confetti", "firework", "party", "balloon", "birthday", "heart"],
  },
  {
    tag: "notification",
    keywords: ["bell", "alert", "badge", "ping"],
  },
];

/**
 * Infer tags from user prompt text.
 * Returns 1-3 tags sorted by match confidence (number of keyword hits).
 */
export function inferTags(prompt: string): AnimationTag[] {
  const lower = prompt.toLowerCase();
  const words = lower.split(/[\s,.\-_:;!?()[\]{}'"]+/).filter(Boolean);

  const scores: { tag: AnimationTag; score: number }[] = [];

  for (const rule of TAG_RULES) {
    let score = 0;
    for (const keyword of rule.keywords) {
      // Check both word-level match and substring match for compound words
      if (words.includes(keyword) || lower.includes(keyword)) {
        score++;
      }
    }
    if (score > 0) {
      scores.push({ tag: rule.tag, score });
    }
  }

  // Sort by score descending, take top 3
  scores.sort((a, b) => b.score - a.score);
  return scores.slice(0, 3).map((s) => s.tag);
}

/**
 * Serialize tags array to a comma-separated string for DB storage.
 */
export function serializeTags(tags: AnimationTag[]): string {
  return tags.join(",");
}

/**
 * Deserialize tags from DB comma-separated string.
 */
export function deserializeTags(tagStr: string | null): AnimationTag[] {
  if (!tagStr) return [];
  return tagStr.split(",").filter((t): t is AnimationTag =>
    TAG_VOCABULARY.includes(t as AnimationTag)
  );
}
