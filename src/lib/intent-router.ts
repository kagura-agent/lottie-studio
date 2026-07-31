/**
 * Natural Language Intent Router
 *
 * Maps free-form user messages to slash command equivalents when confidence is high.
 * Falls through (returns null) for ambiguous or complex creative requests.
 *
 * Design principles:
 * - Only match when intent is clear and unambiguous
 * - Short, action-oriented messages (not long creative descriptions)
 * - Extract simple parameters where obvious
 * - Never guess — return null if unsure
 */

import type { Command, ColorSubcommand } from "./commands";

// Max message length to consider for intent routing.
// Longer messages are likely creative descriptions → send to LLM.
const MAX_INTENT_LENGTH = 80;

// If message contains multiple action words, it's multi-intent → LLM
const MULTI_INTENT_WORDS = /(?:\b(and|then|also|plus|with)\b|.+和.+|.+然后.+|.+还要.+|.+再.+|.+并且.+|.+同时.+)/i;

interface IntentPattern {
  pattern: RegExp;
  build: (match: RegExpMatchArray) => Command | null;
  // If true, skip the multi-intent check (some patterns are inherently short)
  skipMultiCheck?: boolean;
}

const INTENT_PATTERNS: IntentPattern[] = [
  // --- reverse ---
  {
    pattern: /^(?:reverse|play\s*(?:it\s*)?backwards?|backwards?)$/i,
    build: () => ({ type: "reverse" }),
    skipMultiCheck: true,
  },

  // --- loop ---
  {
    pattern: /^(?:loop\s*(?:it)?|make\s*(?:it\s*)?loop|repeat\s*(?:it\s*)?(?:forever)?)$/i,
    build: () => ({ type: "loop", mode: "seamless" }),
    skipMultiCheck: true,
  },
  {
    pattern: /^(?:pingpong|ping\s*pong|loop\s*(?:it\s*)?ping\s*pong|yo-?yo)$/i,
    build: () => ({ type: "loop", mode: "pingpong" }),
    skipMultiCheck: true,
  },

  // --- fade ---
  {
    pattern: /^(?:fade\s*in|fade\s*(?:it\s*)?in)$/i,
    build: () => ({ type: "fade", mode: "in" as const, options: { mode: "in" as const } }),
  },
  {
    pattern: /^(?:fade\s*out|fade\s*(?:it\s*)?out)$/i,
    build: () => ({ type: "fade", mode: "out" as const, options: { mode: "out" as const } }),
  },
  {
    pattern: /^(?:(?:add\s*(?:a\s*)?)?fade|fade\s*(?:effect|animation))$/i,
    build: () => ({ type: "fade", mode: "in" as const, options: { mode: "in" as const } }),
  },

  // --- shadow ---
  {
    pattern: /^(?:(?:add|give\s*(?:it)?|apply)\s*(?:a\s*)?(?:drop\s*)?shadow|shadow\s*(?:effect)?|(?:drop\s*)?shadow)$/i,
    build: () => ({ type: "shadow", options: { shadowType: "drop" as const } }),
  },
  {
    pattern: /^(?:(?:add|give\s*(?:it)?|apply)\s*(?:a\s*)?glow|glow\s*(?:effect)?)$/i,
    build: () => ({ type: "shadow", options: { shadowType: "glow" as const } }),
  },

  // --- blur ---
  {
    pattern: /^(?:(?:add|apply)\s*(?:a\s*)?blur|blur\s*(?:it|effect)?|make\s*(?:it\s*)?blur(?:ry)?)$/i,
    build: () => ({ type: "blur", options: { blurMode: "gaussian" as const } }),
  },
  {
    pattern: /^(?:(?:add\s*)?focus\s*(?:effect)?|depth\s*of\s*field)$/i,
    build: () => ({ type: "blur", options: { blurMode: "focus" as const } }),
  },

  // --- mirror ---
  {
    pattern: /^(?:mirror\s*(?:it\s*)?(?:horizontally?)?|flip\s*(?:it\s*)?(?:horizontally?)?)$/i,
    build: () => ({ type: "mirror_h" }),
  },
  {
    pattern: /^(?:mirror\s*(?:it\s*)?vertically?|flip\s*(?:it\s*)?vertically?)$/i,
    build: () => ({ type: "mirror_v" }),
  },

  // --- physics ---
  {
    pattern: /^(?:(?:add\s*)?bounce|make\s*(?:it\s*)?bounce|bouncing)$/i,
    build: () => ({ type: "physics", options: { effect: "bounce" as const } }),
  },
  {
    pattern: /^(?:(?:add\s*)?gravity|apply\s*gravity|make\s*(?:it\s*)?fall)$/i,
    build: () => ({ type: "physics", options: { effect: "gravity" as const } }),
  },
  {
    pattern: /^(?:(?:add\s*)?(?:a\s*)?pendulum|swing(?:ing)?)$/i,
    build: () => ({ type: "physics", options: { effect: "pendulum" as const } }),
  },
  {
    pattern: /^(?:(?:make\s*(?:it\s*)?)?float(?:ing)?|(?:add\s*)?float\s*(?:effect)?)$/i,
    build: () => ({ type: "physics", options: { effect: "float" as const } }),
  },

  // --- wave ---
  {
    pattern: /^(?:(?:add\s*(?:a\s*)?)?wave|wave\s*(?:effect|animation)|make\s*(?:it\s*)?wave)$/i,
    build: () => ({ type: "wave", options: { waveType: "sine" as const } }),
  },

  // --- shake ---
  {
    pattern: /^(?:(?:add\s*(?:a\s*)?)?shake|shake\s*(?:it|effect)?|make\s*(?:it\s*)?shake)$/i,
    build: () => ({ type: "shake", options: {} }),
  },

  // --- wiggle ---
  {
    pattern: /^(?:(?:add\s*(?:a\s*)?)?wiggle|wiggle\s*(?:it|effect)?|make\s*(?:it\s*)?wiggle)$/i,
    build: () => ({ type: "wiggle", options: {} }),
  },

  // --- spring ---
  {
    pattern: /^(?:(?:add\s*(?:a\s*)?)?spring|spring\s*(?:effect|animation)?|make\s*(?:it\s*)?spring(?:y)?)$/i,
    build: () => ({ type: "spring", options: {} }),
  },

  // --- particle ---
  {
    pattern: /^(?:(?:add\s*)?particles?|particle\s*(?:effect)?|(?:add\s*)?confetti)$/i,
    build: (m) => {
      const isConfetti = /confetti/i.test(m[0]);
      return { type: "particle", particleType: isConfetti ? "confetti" as const : "sparkle" as const, options: {} };
    },
  },
  {
    pattern: /^(?:(?:add\s*)?(?:a\s*)?snow(?:fall)?|make\s*(?:it\s*)?snow)$/i,
    build: () => ({ type: "particle", particleType: "snow" as const, options: {} }),
  },
  {
    pattern: /^(?:(?:add\s*)?(?:a\s*)?rain(?:fall)?|make\s*(?:it\s*)?rain)$/i,
    build: () => ({ type: "particle", particleType: "rain" as const, options: {} }),
  },

  // --- 3d/threed ---
  {
    pattern: /^(?:(?:make\s*(?:it\s*)?)?3d|(?:add\s*)?3d\s*(?:effect)?|(?:add\s*)?perspective)$/i,
    build: () => ({ type: "threed", options: { effect: "flip" as const } }),
  },

  // --- gradient ---
  {
    pattern: /^(?:(?:add\s*(?:a\s*)?)?gradient|gradient\s*(?:fill|effect)?|make\s*(?:it\s*)?gradient)$/i,
    build: () => ({ type: "gradient", options: { gradientType: "linear" as const } }),
  },

  // --- mask ---
  {
    pattern: /^(?:(?:add\s*(?:a\s*)?)?mask|mask\s*(?:effect|it)?|(?:add\s*)?reveal\s*(?:effect)?)$/i,
    build: () => ({ type: "mask", maskType: "reveal" as const, options: {} }),
  },

  // --- repeat/pattern ---
  {
    pattern: /^(?:(?:add\s*(?:a\s*)?)?(?:repeat|pattern)|repeat\s*(?:it|pattern)?|make\s*(?:a\s*)?(?:grid|array|pattern))$/i,
    build: () => ({ type: "repeat", options: { pattern: "grid" as const } }),
  },

  // --- trail ---
  {
    pattern: /^(?:(?:add\s*(?:a\s*)?)?trail|trail\s*(?:effect)?|(?:add\s*)?motion\s*trail)$/i,
    build: () => ({ type: "trail", options: {} }),
  },

  // --- draw ---
  {
    pattern: /^(?:(?:add\s*(?:a\s*)?)?(?:line\s*)?draw(?:ing)?|draw\s*(?:effect|animation)?|(?:stroke\s*)?reveal)$/i,
    build: () => ({ type: "draw", options: {} }),
  },

  // --- slide ---
  {
    pattern: /^(?:slide\s*(?:it\s*)?in|slide\s*in)$/i,
    build: () => ({ type: "slide", direction: "left" as const, options: { direction: "left" as const } }),
  },
  {
    pattern: /^(?:slide\s*(?:it\s*)?out|slide\s*out)$/i,
    build: () => ({ type: "slide", direction: "left" as const, options: { direction: "left" as const, out: true } }),
  },
  {
    pattern: /^(?:slide\s*(?:it\s*)?(?:from\s*)?(?:the\s*)?(?:left|right|top|bottom|up|down))$/i,
    build: (m) => {
      const dir = m[0].match(/left|right|top|up|bottom|down/i)?.[0]?.toLowerCase() || "left";
      const mapped = dir === "up" ? "top" : dir === "down" ? "bottom" : dir;
      return { type: "slide", direction: mapped as "left" | "right" | "top" | "bottom", options: { direction: mapped as "left" | "right" | "top" | "bottom" } };
    },
  },

  // --- rotate ---
  {
    pattern: /^(?:(?:add\s*)?spin(?:ning)?|make\s*(?:it\s*)?spin|rotate\s*(?:it)?)$/i,
    build: () => ({ type: "rotate", degrees: 360 }),
    skipMultiCheck: true,
  },

  // --- scale ---
  {
    pattern: /^(?:(?:make\s*(?:it\s*)?)?(?:bigger|larger|grow)|scale\s*(?:it\s*)?up|enlarge)$/i,
    build: () => ({ type: "scale", factor: 1.5 }),
    skipMultiCheck: true,
  },
  {
    pattern: /^(?:(?:make\s*(?:it\s*)?)?(?:smaller|shrink)|scale\s*(?:it\s*)?down)$/i,
    build: () => ({ type: "scale", factor: 0.5 }),
    skipMultiCheck: true,
  },

  // --- optimize ---
  {
    pattern: /^(?:optimize|compress|reduce\s*(?:file\s*)?size)$/i,
    build: () => ({ type: "optimize" }),
    skipMultiCheck: true,
  },

  // --- transition ---
  {
    pattern: /^(?:(?:add\s*(?:a\s*)?)?transition|transition\s*(?:effect)?)$/i,
    build: () => ({ type: "transition", options: { transitionType: "fade" as const } }),
  },

  // --- sequence ---
  {
    pattern: /^(?:(?:chain|sequence)\s*(?:the\s*)?animations?|(?:add\s*(?:to\s*)?)?sequence)$/i,
    build: () => ({ type: "sequence_list" }),
  },

  // --- stagger ---
  {
    pattern: /^(?:(?:add\s*)?stagger|stagger\s*(?:it|them|effect)?|(?:make\s*(?:them\s*)?)?stagger(?:ed)?)$/i,
    build: () => ({ type: "stagger", delayMs: 100, order: "normal" }),
  },

  // --- easing ---
  {
    pattern: /^(?:(?:make\s*(?:it\s*)?)?smooth(?:er)?|ease\s*(?:it\s*)?(?:in\s*out)?|(?:add\s*)?easing)$/i,
    build: () => ({ type: "easing", preset: "ease-in-out" as const }),
  },

  // --- morph ---
  {
    pattern: /^(?:morph\s*(?:it)?|(?:add\s*(?:a\s*)?)?morph|shape\s*morph)$/i,
    build: () => ({ type: "morph", shape: "circle" as const, options: {} }),
  },

  // --- camera ---
  {
    pattern: /^(?:(?:add\s*(?:a\s*)?)?zoom\s*in|zoom\s*in)$/i,
    build: () => ({ type: "camera", movement: "zoom-in" as const, options: { movement: "zoom-in" as const } }),
  },
  {
    pattern: /^(?:(?:add\s*(?:a\s*)?)?zoom\s*out|zoom\s*out)$/i,
    build: () => ({ type: "camera", movement: "zoom-out" as const, options: { movement: "zoom-out" as const } }),
  },
  {
    pattern: /^(?:(?:add\s*(?:a\s*)?)?(?:camera\s*)?pan|pan\s*(?:it)?)$/i,
    build: () => ({ type: "camera", movement: "pan" as const, options: { movement: "pan" as const } }),
  },

  // --- critique ---
  {
    pattern: /^(?:critique|review|analyze|what(?:'s|\s*is)\s*wrong)$/i,
    build: () => ({ type: "critique" }),
    skipMultiCheck: true,
  },

  // --- fix ---
  {
    pattern: /^(?:fix\s*(?:it)?|repair|auto\s*fix)$/i,
    build: () => ({ type: "fix" }),
    skipMultiCheck: true,
  },

  // --- polish ---
  {
    pattern: /^(?:polish|clean\s*(?:it\s*)?up|refine)$/i,
    build: () => ({ type: "polish" }),
    skipMultiCheck: true,
  },

  // --- retime ---
  {
    pattern: /^(?:(?:make\s*(?:it\s*)?)?(?:faster|speed\s*(?:it\s*)?up))$/i,
    build: () => ({ type: "speed", speed: 2 }),
    skipMultiCheck: true,
  },
  {
    pattern: /^(?:(?:make\s*(?:it\s*)?)?(?:slower|slow\s*(?:it\s*)?down))$/i,
    build: () => ({ type: "speed", speed: 0.5 }),
    skipMultiCheck: true,
  },

  // --- color: warm/cool ---
  {
    pattern: /^(?:make\s*(?:it\s*)?warm(?:er)?)$/i,
    build: () => ({ type: "color", subcommand: { action: "warm" } as ColorSubcommand }),
  },
  {
    pattern: /^(?:make\s*(?:it\s*)?cool(?:er)?)$/i,
    build: () => ({ type: "color", subcommand: { action: "cool" } as ColorSubcommand }),
  },

  // --- color: invert ---
  {
    pattern: /^(?:invert\s*(?:the\s*)?(?:colors?|it)|invert)$/i,
    build: () => ({ type: "color", subcommand: { action: "invert" } as ColorSubcommand }),
    skipMultiCheck: true,
  },

  // --- color: brighten/darken ---
  {
    pattern: /^(?:make\s*(?:it\s*)?(?:brighter|lighter)|brighten)$/i,
    build: () => ({ type: "color", subcommand: { action: "brighten", amount: 0.2 } as ColorSubcommand }),
  },
  {
    pattern: /^(?:make\s*(?:it\s*)?(?:darker|dimmer)|darken)$/i,
    build: () => ({ type: "color", subcommand: { action: "brighten", amount: -0.2 } as ColorSubcommand }),
  },

  // --- color: saturate/desaturate ---
  {
    pattern: /^(?:(?:make\s*(?:it\s*)?)?(?:more\s*)?(?:saturated|vivid|vibrant)|saturate)$/i,
    build: () => ({ type: "color", subcommand: { action: "saturate", amount: 0.3 } as ColorSubcommand }),
  },
  {
    pattern: /^(?:(?:make\s*(?:it\s*)?)?(?:desaturated?|muted|dull)|desaturate)$/i,
    build: () => ({ type: "color", subcommand: { action: "saturate", amount: -0.3 } as ColorSubcommand }),
  },

  // --- color: monochrome ---
  {
    pattern: /^(?:grayscale|grey\s*scale|black\s*(?:and|&)\s*white|monochrome)$/i,
    build: () => ({ type: "color", subcommand: { action: "mono" } as ColorSubcommand }),
    skipMultiCheck: true,
  },

  // --- color: named color swap ---
  {
    pattern: /^(?:make\s*(?:it\s*)?)(red|blue|green|yellow|orange|pink|purple|cyan|white|black|gold|teal)$/i,
    build: (m) => {
      const colorMap: Record<string, string> = {
        red: "#ff0000", blue: "#0066ff", green: "#00cc00", yellow: "#ffcc00",
        orange: "#ff6600", pink: "#ff69b4", purple: "#9900cc", cyan: "#00cccc",
        white: "#ffffff", black: "#000000", gold: "#ffd700", teal: "#008080",
      };
      const name = m[1].toLowerCase();
      return { type: "color", subcommand: { action: "swap", from: "all", to: colorMap[name] } as ColorSubcommand };
    },
  },

  // --- color: hex color swap ---
  {
    pattern: /^(?:make\s*(?:it\s*)?|change\s*(?:(?:it|color)\s*)?to\s*)(#[0-9a-f]{3,8})$/i,
    build: (m) => ({ type: "color", subcommand: { action: "swap", from: "all", to: m[1].toLowerCase() } as ColorSubcommand }),
  },

  // --- color: show palette ---
  {
    pattern: /^(?:show\s*(?:the\s*)?(?:colors?|palette)|what\s*colors?)$/i,
    build: () => ({ type: "color", subcommand: { action: "palette" } as ColorSubcommand }),
    skipMultiCheck: true,
  },

  // --- help ---
  {
    pattern: /^(?:help|what\s*can\s*you\s*do|commands?|show\s*commands?)$/i,
    build: () => ({ type: "help" }),
    skipMultiCheck: true,
  },

  // === Chinese (zh) patterns ===

  // --- reverse ---
  {
    pattern: /^(?:反转|倒放)$/,
    build: () => ({ type: "reverse" }),
    skipMultiCheck: true,
  },

  // --- loop ---
  {
    pattern: /^(?:循环|重复)$/,
    build: () => ({ type: "loop", mode: "seamless" }),
    skipMultiCheck: true,
  },
  {
    pattern: /^(?:来回|乒乓)$/,
    build: () => ({ type: "loop", mode: "pingpong" }),
    skipMultiCheck: true,
  },

  // --- fade ---
  {
    pattern: /^淡入$/,
    build: () => ({ type: "fade", mode: "in" as const, options: { mode: "in" as const } }),
  },
  {
    pattern: /^淡出$/,
    build: () => ({ type: "fade", mode: "out" as const, options: { mode: "out" as const } }),
  },

  // --- shadow ---
  {
    pattern: /^(?:阴影|投影)$/,
    build: () => ({ type: "shadow", options: { shadowType: "drop" as const } }),
  },
  {
    pattern: /^发光$/,
    build: () => ({ type: "shadow", options: { shadowType: "glow" as const } }),
  },

  // --- blur ---
  {
    pattern: /^模糊$/,
    build: () => ({ type: "blur", options: { blurMode: "gaussian" as const } }),
  },
  {
    pattern: /^(?:对焦|景深)$/,
    build: () => ({ type: "blur", options: { blurMode: "focus" as const } }),
  },

  // --- mirror ---
  {
    pattern: /^(?:镜像|水平翻转)$/,
    build: () => ({ type: "mirror_h" }),
  },
  {
    pattern: /^垂直翻转$/,
    build: () => ({ type: "mirror_v" }),
  },

  // --- physics ---
  {
    pattern: /^弹跳$/,
    build: () => ({ type: "physics", options: { effect: "bounce" as const } }),
  },
  {
    pattern: /^(?:重力|下落)$/,
    build: () => ({ type: "physics", options: { effect: "gravity" as const } }),
  },
  {
    pattern: /^(?:摆动|钟摆)$/,
    build: () => ({ type: "physics", options: { effect: "pendulum" as const } }),
  },
  {
    pattern: /^(?:漂浮|悬浮)$/,
    build: () => ({ type: "physics", options: { effect: "float" as const } }),
  },

  // --- wave ---
  {
    pattern: /^波浪$/,
    build: () => ({ type: "wave", options: { waveType: "sine" as const } }),
  },

  // --- shake ---
  {
    pattern: /^抖动$/,
    build: () => ({ type: "shake", options: {} }),
  },

  // --- wiggle ---
  {
    pattern: /^摇摆$/,
    build: () => ({ type: "wiggle", options: {} }),
  },

  // --- spring ---
  {
    pattern: /^弹簧$/,
    build: () => ({ type: "spring", options: {} }),
  },

  // --- particle ---
  {
    pattern: /^(?:粒子|闪光)$/,
    build: () => ({ type: "particle", particleType: "sparkle" as const, options: {} }),
  },
  {
    pattern: /^(?:纷飞|彩纸)$/,
    build: () => ({ type: "particle", particleType: "confetti" as const, options: {} }),
  },
  {
    pattern: /^(?:雪|下雪)$/,
    build: () => ({ type: "particle", particleType: "snow" as const, options: {} }),
  },
  {
    pattern: /^(?:雨|下雨)$/,
    build: () => ({ type: "particle", particleType: "rain" as const, options: {} }),
  },

  // --- 3d ---
  {
    pattern: /^(?:3D|立体)$/,
    build: () => ({ type: "threed", options: { effect: "flip" as const } }),
  },

  // --- gradient ---
  {
    pattern: /^渐变$/,
    build: () => ({ type: "gradient", options: { gradientType: "linear" as const } }),
  },

  // --- mask ---
  {
    pattern: /^(?:遮罩|揭示)$/,
    build: () => ({ type: "mask", maskType: "reveal" as const, options: {} }),
  },

  // --- repeat ---
  {
    pattern: /^(?:阵列|网格)$/,
    build: () => ({ type: "repeat", options: { pattern: "grid" as const } }),
  },

  // --- trail ---
  {
    pattern: /^(?:拖影|残影)$/,
    build: () => ({ type: "trail", options: {} }),
  },

  // --- draw ---
  {
    pattern: /^(?:描边|绘制)$/,
    build: () => ({ type: "draw", options: {} }),
  },

  // --- slide ---
  {
    pattern: /^滑入$/,
    build: () => ({ type: "slide", direction: "left" as const, options: { direction: "left" as const } }),
  },
  {
    pattern: /^滑出$/,
    build: () => ({ type: "slide", direction: "left" as const, options: { direction: "left" as const, out: true } }),
  },

  // --- rotate ---
  {
    pattern: /^旋转$/,
    build: () => ({ type: "rotate", degrees: 360 }),
    skipMultiCheck: true,
  },

  // --- scale ---
  {
    pattern: /^(?:放大|变大)$/,
    build: () => ({ type: "scale", factor: 1.5 }),
    skipMultiCheck: true,
  },
  {
    pattern: /^(?:缩小|变小)$/,
    build: () => ({ type: "scale", factor: 0.5 }),
    skipMultiCheck: true,
  },

  // --- optimize ---
  {
    pattern: /^(?:优化|压缩)$/,
    build: () => ({ type: "optimize" }),
    skipMultiCheck: true,
  },

  // --- transition ---
  {
    pattern: /^过渡$/,
    build: () => ({ type: "transition", options: { transitionType: "fade" as const } }),
  },

  // --- sequence ---
  {
    pattern: /^(?:序列|连接)$/,
    build: () => ({ type: "sequence_list" }),
  },

  // --- stagger ---
  {
    pattern: /^交错$/,
    build: () => ({ type: "stagger", delayMs: 100, order: "normal" }),
  },

  // --- easing ---
  {
    pattern: /^(?:平滑|缓动)$/,
    build: () => ({ type: "easing", preset: "ease-in-out" as const }),
  },

  // --- morph ---
  {
    pattern: /^变形$/,
    build: () => ({ type: "morph", shape: "circle" as const, options: {} }),
  },

  // --- camera ---
  {
    pattern: /^放大镜头$/,
    build: () => ({ type: "camera", movement: "zoom-in" as const, options: { movement: "zoom-in" as const } }),
  },
  {
    pattern: /^缩小镜头$/,
    build: () => ({ type: "camera", movement: "zoom-out" as const, options: { movement: "zoom-out" as const } }),
  },
  {
    pattern: /^平移$/,
    build: () => ({ type: "camera", movement: "pan" as const, options: { movement: "pan" as const } }),
  },

  // --- critique ---
  {
    pattern: /^(?:评审|分析)$/,
    build: () => ({ type: "critique" }),
    skipMultiCheck: true,
  },

  // --- fix ---
  {
    pattern: /^修复$/,
    build: () => ({ type: "fix" }),
    skipMultiCheck: true,
  },

  // --- polish ---
  {
    pattern: /^润色$/,
    build: () => ({ type: "polish" }),
    skipMultiCheck: true,
  },

  // --- speed ---
  {
    pattern: /^(?:加快|加速)$/,
    build: () => ({ type: "speed", speed: 2 }),
    skipMultiCheck: true,
  },
  {
    pattern: /^(?:减慢|减速)$/,
    build: () => ({ type: "speed", speed: 0.5 }),
    skipMultiCheck: true,
  },

  // --- color ---
  {
    pattern: /^(?:暖色|变暖)$/,
    build: () => ({ type: "color", subcommand: { action: "warm" } as ColorSubcommand }),
  },
  {
    pattern: /^(?:冷色|变冷)$/,
    build: () => ({ type: "color", subcommand: { action: "cool" } as ColorSubcommand }),
  },
  {
    pattern: /^反色$/,
    build: () => ({ type: "color", subcommand: { action: "invert" } as ColorSubcommand }),
    skipMultiCheck: true,
  },
  {
    pattern: /^变亮$/,
    build: () => ({ type: "color", subcommand: { action: "brighten", amount: 0.2 } as ColorSubcommand }),
  },
  {
    pattern: /^变暗$/,
    build: () => ({ type: "color", subcommand: { action: "brighten", amount: -0.2 } as ColorSubcommand }),
  },
  {
    pattern: /^(?:饱和|鲜艳)$/,
    build: () => ({ type: "color", subcommand: { action: "saturate", amount: 0.3 } as ColorSubcommand }),
  },
  {
    pattern: /^(?:去饱和|暗淡)$/,
    build: () => ({ type: "color", subcommand: { action: "saturate", amount: -0.3 } as ColorSubcommand }),
  },
  {
    pattern: /^(?:灰度|黑白|单色)$/,
    build: () => ({ type: "color", subcommand: { action: "mono" } as ColorSubcommand }),
    skipMultiCheck: true,
  },
  {
    pattern: /^变(红|蓝|绿|黄|橙|粉|紫|白|黑|金)$/,
    build: (m) => {
      const colorMap: Record<string, string> = {
        红: "#ff0000", 蓝: "#0066ff", 绿: "#00cc00", 黄: "#ffcc00",
        橙: "#ff6600", 粉: "#ff69b4", 紫: "#9900cc", 白: "#ffffff",
        黑: "#000000", 金: "#ffd700",
      };
      return { type: "color", subcommand: { action: "swap", from: "all", to: colorMap[m[1]] } as ColorSubcommand };
    },
  },
  {
    pattern: /^(?:显示颜色|调色板)$/,
    build: () => ({ type: "color", subcommand: { action: "palette" } as ColorSubcommand }),
    skipMultiCheck: true,
  },

  // --- help ---
  {
    pattern: /^帮助$/,
    build: () => ({ type: "help" }),
    skipMultiCheck: true,
  },
];

/**
 * Detect if a user message maps to a known slash command intent.
 * Returns the parsed Command or null if no confident match.
 *
 * Only matches short, action-oriented messages.
 * Complex or multi-intent messages are sent to the LLM.
 */
export function detectIntent(message: string): Command | null {
  const trimmed = message.trim();

  // Skip empty messages
  if (!trimmed) return null;

  // Skip if it starts with / (already a slash command)
  if (trimmed.startsWith("/")) return null;

  // Skip very long messages — likely creative descriptions
  if (trimmed.length > MAX_INTENT_LENGTH) return null;

  // Skip messages that look like creative prompts (contain "create", "make me", "design", "generate")
  if (/^(?:create|make\s*me|design|generate|draw\s*me|build)\s/i.test(trimmed)) {
    // Exception: "make it X" patterns are modifications, not creations
    if (!/^make\s*(?:it|them)\s/i.test(trimmed)) return null;
  }
  if (/^(?:创建|画一个|生成|设计|做一个)/.test(trimmed)) return null;

  for (const intent of INTENT_PATTERNS) {
    const match = trimmed.match(intent.pattern);
    if (match) {
      // Check for multi-intent (unless pattern is inherently short)
      if (!intent.skipMultiCheck && MULTI_INTENT_WORDS.test(trimmed)) {
        return null;
      }
      return intent.build(match);
    }
  }

  return null;
}
