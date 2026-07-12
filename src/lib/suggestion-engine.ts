import type { PromptSuggestion } from "@/data/prompt-suggestions";

interface LottieJson {
  layers?: Array<Record<string, unknown>>;
  fr?: number;
  ip?: number;
  op?: number;
  w?: number;
  h?: number;
  [key: string]: unknown;
}

interface SuggestionRule {
  match: (json: LottieJson, selectedLayer?: Record<string, unknown> | null) => boolean;
  suggest: (json: LottieJson, selectedLayer?: Record<string, unknown> | null) => PromptSuggestion;
}

function countKeyframes(layer: Record<string, unknown>): number {
  let count = 0;
  const ks = layer.ks as Record<string, unknown> | undefined;
  if (!ks) return 0;
  for (const prop of Object.values(ks)) {
    if (prop && typeof prop === "object" && (prop as Record<string, unknown>).a === 1) {
      count++;
    }
  }
  return count;
}

function extractColors(json: LottieJson): string[] {
  const colors: string[] = [];
  const walk = (obj: unknown) => {
    if (!obj || typeof obj !== "object") return;
    if (Array.isArray(obj)) {
      obj.forEach(walk);
      return;
    }
    const rec = obj as Record<string, unknown>;
    if (rec.ty === "fl" || rec.ty === "st") {
      const c = (rec.c as Record<string, unknown>)?.k;
      if (Array.isArray(c) && c.length >= 3) {
        colors.push(`rgb(${Math.round((c[0] as number) * 255)},${Math.round((c[1] as number) * 255)},${Math.round((c[2] as number) * 255)})`);
      }
    }
    Object.values(rec).forEach(walk);
  };
  walk(json.layers);
  return [...new Set(colors)];
}

function hasLinearEasing(json: LottieJson): boolean {
  let found = false;
  const walk = (obj: unknown) => {
    if (found || !obj || typeof obj !== "object") return;
    if (Array.isArray(obj)) {
      obj.forEach(walk);
      return;
    }
    const rec = obj as Record<string, unknown>;
    if (Array.isArray(rec.k)) {
      for (const kf of rec.k as Array<Record<string, unknown>>) {
        const o = kf.o as Record<string, unknown> | undefined;
        const i = kf.i as Record<string, unknown> | undefined;
        if (o && i) {
          const ox = (o.x as number[] | number) ?? 0;
          const oy = (o.y as number[] | number) ?? 0;
          const ix = (i.x as number[] | number) ?? 0;
          const iy = (i.y as number[] | number) ?? 0;
          const isLin = (v: number[] | number) => {
            const arr = Array.isArray(v) ? v : [v];
            return arr.every((n) => Math.abs(n - 0.333) < 0.05 || Math.abs(n - 0.667) < 0.05 || n === 0 || n === 1);
          };
          if (isLin(ox) && isLin(oy) && isLin(ix) && isLin(iy)) {
            found = true;
            return;
          }
        }
      }
    }
    Object.values(rec).forEach(walk);
  };
  walk(json.layers);
  return found;
}

function getLayerTypes(json: LottieJson): Set<number> {
  const types = new Set<number>();
  for (const layer of json.layers ?? []) {
    if (typeof layer.ty === "number") types.add(layer.ty);
  }
  return types;
}

const rules: SuggestionRule[] = [
  {
    match: (_json, sel) => sel != null && (sel.ty as number) === 4,
    suggest: (_json, sel) => ({
      emoji: "🎨",
      label: `Restyle "${(sel!.nm as string) || "shape"}"`,
      prompt: `Change the colors and style of the "${(sel!.nm as string) || "selected shape"}" layer to something more vibrant and modern`,
    }),
  },
  {
    match: (_json, sel) => sel != null && (sel.ty as number) === 5,
    suggest: (_json, sel) => ({
      emoji: "✍️",
      label: `Animate "${(sel!.nm as string) || "text"}"`,
      prompt: `Add a typewriter reveal animation to the "${(sel!.nm as string) || "text"}" layer with a blinking cursor`,
    }),
  },
  {
    match: (_json, sel) => sel != null && countKeyframes(sel) === 0,
    suggest: (_json, sel) => ({
      emoji: "💫",
      label: `Animate "${(sel!.nm as string) || "layer"}"`,
      prompt: `Add a smooth entrance animation to the "${(sel!.nm as string) || "selected"}" layer with scale and fade`,
    }),
  },
  {
    match: (json) => {
      const layers = json.layers ?? [];
      const totalKf = layers.reduce((sum, l) => sum + countKeyframes(l), 0);
      return layers.length > 0 && totalKf <= 2;
    },
    suggest: () => ({
      emoji: "🎬",
      label: "Add more motion",
      prompt: "Make this animation more dynamic by adding secondary motion, overlapping timing, and easing variations",
    }),
  },
  {
    match: (json) => extractColors(json).length === 1,
    suggest: () => ({
      emoji: "🌈",
      label: "Add color variety",
      prompt: "Introduce a complementary color palette to this animation while keeping the overall style cohesive",
    }),
  },
  {
    match: (json) => extractColors(json).length > 0,
    suggest: (json) => {
      const colors = extractColors(json);
      return {
        emoji: "🎨",
        label: "Try new palette",
        prompt: `Change the color scheme to a different mood — currently using ${colors.length} color${colors.length > 1 ? "s" : ""}. Try something warmer or cooler.`,
      };
    },
  },
  {
    match: (json) => hasLinearEasing(json),
    suggest: () => ({
      emoji: "🏀",
      label: "Improve easing",
      prompt: "Replace the linear easing with more natural motion — use ease-out for entrances and elastic/bounce for playful elements",
    }),
  },
  {
    match: (json) => (json.layers?.length ?? 0) <= 2,
    suggest: () => ({
      emoji: "✨",
      label: "Add visual elements",
      prompt: "Add supporting visual elements like particles, shadows, or a subtle background pattern to make this richer",
    }),
  },
  {
    match: (json) => getLayerTypes(json).has(4),
    suggest: () => ({
      emoji: "🔮",
      label: "Add glow effect",
      prompt: "Add a soft glow or shadow effect to the shapes to give them more depth and polish",
    }),
  },
  {
    match: (json) => {
      const dur = ((json.op ?? 0) - (json.ip ?? 0)) / (json.fr ?? 30);
      return dur > 0 && dur < 1.5;
    },
    suggest: () => ({
      emoji: "⏱️",
      label: "Extend duration",
      prompt: "Make this animation longer with additional stages or a more gradual build-up before the main action",
    }),
  },
  {
    match: (json) => {
      const dur = ((json.op ?? 0) - (json.ip ?? 0)) / (json.fr ?? 30);
      return dur > 4;
    },
    suggest: () => ({
      emoji: "⚡",
      label: "Speed it up",
      prompt: "Make this animation snappier by tightening the timing and reducing pauses between movements",
    }),
  },
  {
    match: (json) => getLayerTypes(json).has(5),
    suggest: () => ({
      emoji: "📝",
      label: "Enhance text",
      prompt: "Add a creative text animation — try a wave effect, letter-by-letter reveal, or kinetic typography style",
    }),
  },
];

export function analyzeAnimation(
  json: unknown,
  selectedLayer?: Record<string, unknown> | null,
): PromptSuggestion[] {
  if (!json || typeof json !== "object") return [];
  const lottie = json as LottieJson;
  if (!lottie.layers || !Array.isArray(lottie.layers)) return [];

  const suggestions: PromptSuggestion[] = [];
  const seen = new Set<string>();

  for (const rule of rules) {
    if (suggestions.length >= 4) break;
    try {
      if (rule.match(lottie, selectedLayer)) {
        const s = rule.suggest(lottie, selectedLayer);
        if (!seen.has(s.label)) {
          seen.add(s.label);
          suggestions.push(s);
        }
      }
    } catch {
      // skip rules that throw on malformed data
    }
  }

  return suggestions;
}
