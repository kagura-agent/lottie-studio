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

import type { Command, ColorSubcommand, TrimPoint, StyleName } from "./commands";
import type { SlideDirection } from "./slide";

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
  // --- undo ---
  {
    pattern: /^(?:undo(?:\s*(?:that|it))?|go\s*back|never\s*mind|nvm|revert(?:\s*that)?)$/i,
    build: () => ({ type: "undo" }),
    skipMultiCheck: true,
  },

  // --- redo ---
  {
    pattern: /^(?:redo(?:\s*(?:that|it))?)$/i,
    build: () => ({ type: "redo" }),
    skipMultiCheck: true,
  },

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
    build: () => ({ type: "shadow", options: { type: "drop" as const } }),
  },
  {
    pattern: /^(?:(?:add|give\s*(?:it)?|apply)\s*(?:a\s*)?glow|glow\s*(?:effect)?)$/i,
    build: () => ({ type: "shadow", options: { type: "glow" as const } }),
  },

  // --- blur ---
  {
    pattern: /^(?:(?:add|apply)\s*(?:a\s*)?blur|blur\s*(?:it|effect)?|make\s*(?:it\s*)?blur(?:ry)?)$/i,
    build: () => ({ type: "blur", options: { mode: "in" as const } }),
  },
  {
    pattern: /^(?:(?:add\s*)?focus\s*(?:effect)?|depth\s*of\s*field)$/i,
    build: () => ({ type: "blur", options: { mode: "pulse" as const } }),
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

  // --- path motion ---
  {
    pattern: /^(?:(?:move|go)\s*(?:it\s*)?in\s*(?:a\s*)?circle|orbit|circular\s*(?:path|motion)|go\s*around)$/i,
    build: () => ({ type: "path", shape: "circle" as const, options: { shape: "circle" as const } }),
  },
  {
    pattern: /^(?:(?:wave|wavy|sine)\s*(?:path|motion)|(?:move|go)\s*(?:along\s*)?(?:a\s*)?(?:wave|wavy|sine)\s*path)$/i,
    build: () => ({ type: "path", shape: "wave" as const, options: { shape: "wave" as const } }),
  },
  {
    pattern: /^(?:spiral(?:\s*(?:path|motion))?|(?:move|go)\s*(?:in\s*)?(?:a\s*)?spiral)$/i,
    build: () => ({ type: "path", shape: "spiral" as const, options: { shape: "spiral" as const } }),
  },
  {
    pattern: /^(?:figure\s*(?:eight|8)|figure-8|infinity\s*(?:path|motion|loop))$/i,
    build: () => ({ type: "path", shape: "figure-8" as const, options: { shape: "figure-8" as const } }),
  },
  {
    pattern: /^(?:arc\s*(?:path|motion)|curved\s*path|(?:move|go)\s*(?:in\s*)?(?:an?\s*)?arc)$/i,
    build: () => ({ type: "path", shape: "arc" as const, options: { shape: "arc" as const } }),
  },
  {
    pattern: /^(?:zigzag\s*(?:path|motion)|(?:move|go)\s*(?:in\s*)?(?:a\s*)?zigzag)$/i,
    build: () => ({ type: "path", shape: "zigzag" as const, options: { shape: "zigzag" as const } }),
  },
  {
    pattern: /^(?:pendulum\s*(?:path|motion\s*path)|swing\s*(?:path|motion\s*path))$/i,
    build: () => ({ type: "path", shape: "pendulum" as const, options: { shape: "pendulum" as const } }),
  },
  {
    pattern: /^(?:(?:move|go)\s*(?:it\s*)?(?:in\s*(?:a\s*)?circle\s*)?(?:clockwise|cw))$/i,
    build: () => ({ type: "path", shape: "circle" as const, options: { shape: "circle" as const, clockwise: true } }),
  },
  {
    pattern: /^(?:(?:move|go)\s*(?:it\s*)?(?:in\s*(?:a\s*)?circle\s*)?(?:counter\s*clockwise|ccw|anticlockwise))$/i,
    build: () => ({ type: "path", shape: "circle" as const, options: { shape: "circle" as const, clockwise: false } }),
  },

  // --- wave ---
  {
    pattern: /^(?:(?:add\s*(?:a\s*)?)?wave|wave\s*(?:effect|animation)|make\s*(?:it\s*)?wave)$/i,
    build: () => ({ type: "wave", options: { type: "sine" as const } }),
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
    build: () => ({ type: "gradient", options: { type: "linear" as const } }),
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
    build: () => ({ type: "trail", options: { count: 5, fade: "exponential" as const, scale: false } }),
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
      const mapped = dir === "top" ? "up" : dir === "bottom" ? "down" : dir;
      return { type: "slide", direction: mapped as SlideDirection, options: { direction: mapped as SlideDirection } };
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
    build: () => ({ type: "transition", options: { type: "fade" as const } }),
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
    build: () => ({ type: "camera", movement: "pan-left" as const, options: { movement: "pan-left" as const } }),
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

  // --- text ---
  {
    pattern: /^(?:typewriter|typing)\s+(?:text\s+)?(.+)$/i,
    build: (m) => ({ type: "text", text: m[1].trim(), options: { style: "typewriter" as const } }),
  },
  {
    pattern: /^(?:bouncing|bounce)\s+text\s+(.+)$/i,
    build: (m) => ({ type: "text", text: m[1].trim(), options: { style: "bounce" as const } }),
  },
  {
    pattern: /^(?:glitch)\s+text\s+(.+)$/i,
    build: (m) => ({ type: "text", text: m[1].trim(), options: { style: "glitch" as const } }),
  },
  {
    pattern: /^(?:wave)\s+text\s+(.+)$/i,
    build: (m) => ({ type: "text", text: m[1].trim(), options: { style: "wave" as const } }),
  },
  {
    pattern: /^(?:fade[- ]?in)\s+text\s+(.+)$/i,
    build: (m) => ({ type: "text", text: m[1].trim(), options: { style: "fade-in" as const } }),
  },
  {
    pattern: /^(?:scale)\s+text\s+(.+)$/i,
    build: (m) => ({ type: "text", text: m[1].trim(), options: { style: "scale" as const } }),
  },
  {
    pattern: /^(?:rotate)\s+text\s+(.+)$/i,
    build: (m) => ({ type: "text", text: m[1].trim(), options: { style: "rotate" as const } }),
  },
  {
    pattern: /^(?:slide)\s+text\s+(.+)$/i,
    build: (m) => ({ type: "text", text: m[1].trim(), options: { style: "slide" as const } }),
  },
  {
    pattern: /^type\s+out\s+(.+)$/i,
    build: (m) => ({ type: "text", text: m[1].trim(), options: { style: "typewriter" as const } }),
  },
  {
    pattern: /^(?:add\s+text|put\s+text(?:\s+saying)?)\s+(.+)$/i,
    build: (m) => ({ type: "text", text: m[1].trim(), options: {} }),
  },
  {
    pattern: /^write\s+(.+)$/i,
    build: (m) => ({ type: "text", text: m[1].trim(), options: {} }),
  },
  {
    pattern: /^text\s+(.+)$/i,
    build: (m) => ({ type: "text", text: m[1].trim(), options: {} }),
  },

  // --- export ---
  {
    pattern: /^(?:export\s+(?:as\s+)?gif|save\s+as\s+gif|download\s+gif)$/i,
    build: () => ({ type: "export_gif" }),
    skipMultiCheck: true,
  },
  {
    pattern: /^(?:export\s+(?:as\s+)?(?:video|mp4)|save\s+as\s+(?:video|mp4)|download\s+(?:video|mp4))$/i,
    build: () => ({ type: "export_video" }),
    skipMultiCheck: true,
  },
  {
    pattern: /^(?:export\s+(?:as\s+)?json|save\s+(?:as\s+)?json|download\s+json)$/i,
    build: () => ({ type: "export_json" }),
    skipMultiCheck: true,
  },
  {
    pattern: /^(?:export\s+(?:as\s+)?dotlottie|save\s+as\s+\.?lottie|export\s+\.?lottie)$/i,
    build: () => ({ type: "export_dotlottie" }),
    skipMultiCheck: true,
  },
  {
    pattern: /^(?:export\s+(?:as\s+)?apng|save\s+as\s+apng|download\s+apng)$/i,
    build: () => ({ type: "export_apng" }),
    skipMultiCheck: true,
  },

  // --- trim ---
  {
    pattern: /^(?:trim\s*(?:it\s*)?to\s+(\d+(?:\.\d+)?)\s*s(?:ec(?:ond)?s?)?|trim\s*(?:it\s*)?to\s+(\d+(?:\.\d+)?)\s*(?:seconds?))$/i,
    build: (m) => {
      const val = parseFloat(m[1] || m[2]);
      return { type: "trim", range: { start: { value: 0, unit: "start" } as TrimPoint, end: { value: val, unit: "seconds" } as TrimPoint } };
    },
  },
  {
    pattern: /^(?:cut|trim)\s*(?:the\s*)?first\s+(\d+(?:\.\d+)?)\s*s(?:ec(?:ond)?s?)?$/i,
    build: (m) => {
      const val = parseFloat(m[1]);
      return { type: "trim", range: { start: { value: 0, unit: "start" } as TrimPoint, end: { value: val, unit: "seconds" } as TrimPoint } };
    },
  },
  {
    pattern: /^(?:trim\s*(?:the\s*)?first\s+second)$/i,
    build: () => ({ type: "trim", range: { start: { value: 0, unit: "start" } as TrimPoint, end: { value: 1, unit: "seconds" } as TrimPoint } }),
  },
  {
    pattern: /^keep\s*(?:the\s*)?last\s+(\d+(?:\.\d+)?)\s*s(?:ec(?:ond)?s?)?$/i,
    build: (m) => {
      const val = parseFloat(m[1]);
      return { type: "trim", range: { start: { value: val, unit: "seconds" } as TrimPoint, end: { value: 0, unit: "end" } as TrimPoint } };
    },
  },
  {
    pattern: /^(?:trim|keep)\s*frames?\s+(\d+)\s*[-–]\s*(\d+)$/i,
    build: (m) => {
      const start = parseInt(m[1]);
      const end = parseInt(m[2]);
      return { type: "trim", range: { start: { value: start, unit: "frame" } as TrimPoint, end: { value: end, unit: "frame" } as TrimPoint } };
    },
  },
  // Chinese trim
  {
    pattern: /^裁剪到(\d+(?:\.\d+)?)秒$/,
    build: (m) => {
      const val = parseFloat(m[1]);
      return { type: "trim", range: { start: { value: 0, unit: "start" } as TrimPoint, end: { value: val, unit: "seconds" } as TrimPoint } };
    },
  },
  {
    pattern: /^截取前(\d+(?:\.\d+)?)秒$/,
    build: (m) => {
      const val = parseFloat(m[1]);
      return { type: "trim", range: { start: { value: 0, unit: "start" } as TrimPoint, end: { value: val, unit: "seconds" } as TrimPoint } };
    },
  },
  {
    pattern: /^保留最后(\d+(?:\.\d+)?)秒$/,
    build: (m) => {
      const val = parseFloat(m[1]);
      return { type: "trim", range: { start: { value: val, unit: "seconds" } as TrimPoint, end: { value: 0, unit: "end" } as TrimPoint } };
    },
  },

  // --- duration ---
  {
    pattern: /^(?:make\s*it|set\s*(?:the\s*)?(?:duration|length)\s*(?:to)?|(?:duration|length)\s*(?:to)?|change\s*(?:the\s*)?(?:duration|length)\s*(?:to)?)\s*(\d+(?:\.\d+)?)\s*s(?:ec(?:ond)?s?)?$/i,
    build: (m) => ({ type: "duration", durationMs: parseFloat(m[1]) * 1000 }),
  },
  {
    pattern: /^(?:make\s*it|set\s*(?:the\s*)?(?:duration|length)\s*(?:to)?|(?:duration|length)\s*(?:to)?|change\s*(?:the\s*)?(?:duration|length)\s*(?:to)?)\s*(\d+)\s*ms$/i,
    build: (m) => ({ type: "duration", durationMs: parseInt(m[1]) }),
  },
  {
    pattern: /^(?:set\s*(?:the\s*)?length|change\s*(?:the\s*)?length\s*to)\s+(\d+(?:\.\d+)?)\s*s(?:ec(?:ond)?s?)?$/i,
    build: (m) => ({ type: "duration", durationMs: parseFloat(m[1]) * 1000 }),
  },
  // Chinese duration
  {
    pattern: /^(?:改成|改为|设为|设置?时长(?:为|设为)?)\s*(\d+(?:\.\d+)?)秒$/,
    build: (m) => ({ type: "duration", durationMs: parseFloat(m[1]) * 1000 }),
  },
  {
    pattern: /^时长设为(\d+(?:\.\d+)?)秒$/,
    build: (m) => ({ type: "duration", durationMs: parseFloat(m[1]) * 1000 }),
  },
  {
    pattern: /^(?:改为|改成|设为)\s*(\d+)\s*毫秒$/,
    build: (m) => ({ type: "duration", durationMs: parseInt(m[1]) }),
  },
  {
    pattern: /^设置时长(\d+(?:\.\d+)?)秒$/,
    build: (m) => ({ type: "duration", durationMs: parseFloat(m[1]) * 1000 }),
  },

  // --- layers ---
  {
    pattern: /^(?:show\s*(?:the\s*)?layers?|list\s*(?:the\s*)?layers?|what\s*layers?|layers?)$/i,
    build: () => ({ type: "layers" }),
    skipMultiCheck: true,
  },
  // Chinese layers
  {
    pattern: /^(?:显示图层|有哪些图层|图层列表|查看图层|图层)$/,
    build: () => ({ type: "layers" }),
    skipMultiCheck: true,
  },

  // --- help ---
  {
    pattern: /^(?:help|what\s*can\s*you\s*do|commands?|show\s*commands?)$/i,
    build: () => ({ type: "help" }),
    skipMultiCheck: true,
  },

  // --- style ---
  {
    pattern: /^(?:(?:make\s*(?:it\s*)?|apply\s*(?:a\s*)?|go\s*|use\s*)?neon(?:\s*(?:style|look|vibe|colors?|theme))?)$/i,
    build: () => ({ type: "style", style: "neon" as StyleName }),
  },
  {
    pattern: /^(?:(?:make\s*(?:it\s*)?|apply\s*(?:a\s*)?|go\s*|use\s*)?pastel(?:\s*(?:style|look|vibe|colors?|theme))?|soft\s*pastels?)$/i,
    build: () => ({ type: "style", style: "pastel" as StyleName }),
  },
  {
    pattern: /^(?:(?:make\s*(?:it\s*)?|apply\s*(?:a\s*)?|go\s*|use\s*)?monochrome(?:\s*(?:style|look|vibe|colors?|theme))?|black\s*(?:and|&)\s*white\s*style|mono(?:\s*(?:style|look|vibe|theme)))$/i,
    build: () => ({ type: "style", style: "monochrome" as StyleName }),
    skipMultiCheck: true,
  },
  {
    pattern: /^(?:(?:make\s*(?:it\s*)?|apply\s*(?:a\s*)?|go\s*|use\s*)?gradient(?:\s*(?:style|look|vibe|colors?|theme)))$/i,
    build: () => ({ type: "style", style: "gradient" as StyleName }),
  },
  {
    pattern: /^(?:(?:make\s*(?:it\s*)?|apply\s*(?:a\s*)?|go\s*|use\s*)?retro(?:\s*(?:style|look|vibe|colors?|theme))?|vintage\s*look)$/i,
    build: () => ({ type: "style", style: "retro" as StyleName }),
  },
  {
    pattern: /^(?:(?:make\s*(?:it\s*)?|apply\s*(?:a\s*)?|go\s*|use\s*)?minimal(?:\s*(?:style|look|vibe|colors?|theme))?|minimalist|clean\s*style)$/i,
    build: () => ({ type: "style", style: "minimal" as StyleName }),
  },
  {
    pattern: /^(?:(?:make\s*(?:it\s*)?|apply\s*(?:a\s*)?|go\s*|use\s*)?bold(?:\s*(?:style|look|vibe|colors?|theme))?)$/i,
    build: () => ({ type: "style", style: "bold" as StyleName }),
  },
  {
    pattern: /^(?:(?:make\s*(?:it\s*)?|apply\s*(?:a\s*)?|go\s*|use\s*)?nature(?:\s*(?:style|look|vibe|colors?|theme))?|earthy|organic\s*style)$/i,
    build: () => ({ type: "style", style: "nature" as StyleName }),
  },
  {
    pattern: /^(?:(?:list|show|what)\s*(?:are\s*(?:the\s*)?)?styles?|style\s*list|available\s*styles?)$/i,
    build: () => ({ type: "style_list" }),
    skipMultiCheck: true,
  },
  {
    pattern: /^(?:make\s*(?:it\s*)?look\s*(?:like\s*)?|style\s*(?:it\s*)?(?:like|as)\s*)(.+)$/i,
    build: (m) => ({ type: "style_custom", description: m[1].trim() }),
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
    build: () => ({ type: "shadow", options: { type: "drop" as const } }),
  },
  {
    pattern: /^发光$/,
    build: () => ({ type: "shadow", options: { type: "glow" as const } }),
  },

  // --- blur ---
  {
    pattern: /^模糊$/,
    build: () => ({ type: "blur", options: { mode: "in" as const } }),
  },
  {
    pattern: /^(?:对焦|景深)$/,
    build: () => ({ type: "blur", options: { mode: "pulse" as const } }),
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

  // --- path motion ---
  {
    pattern: /^(?:圆形路径|绕圈|绕圆)$/,
    build: () => ({ type: "path", shape: "circle" as const, options: { shape: "circle" as const } }),
  },
  {
    pattern: /^螺旋路径$/,
    build: () => ({ type: "path", shape: "spiral" as const, options: { shape: "spiral" as const } }),
  },
  {
    pattern: /^弧形路径$/,
    build: () => ({ type: "path", shape: "arc" as const, options: { shape: "arc" as const } }),
  },
  {
    pattern: /^之字形路径$/,
    build: () => ({ type: "path", shape: "zigzag" as const, options: { shape: "zigzag" as const } }),
  },
  {
    pattern: /^8字形$/,
    build: () => ({ type: "path", shape: "figure-8" as const, options: { shape: "figure-8" as const } }),
  },
  {
    pattern: /^钟摆路径$/,
    build: () => ({ type: "path", shape: "pendulum" as const, options: { shape: "pendulum" as const } }),
  },
  {
    pattern: /^沿路径$/,
    build: () => ({ type: "path", shape: "circle" as const, options: { shape: "circle" as const } }),
  },
  {
    pattern: /^顺时针$/,
    build: () => ({ type: "path", shape: "circle" as const, options: { shape: "circle" as const, clockwise: true } }),
  },
  {
    pattern: /^逆时针$/,
    build: () => ({ type: "path", shape: "circle" as const, options: { shape: "circle" as const, clockwise: false } }),
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
    build: () => ({ type: "wave", options: { type: "sine" as const } }),
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
    build: () => ({ type: "gradient", options: { type: "linear" as const } }),
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
    build: () => ({ type: "trail", options: { count: 5, fade: "exponential" as const, scale: false } }),
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
    build: () => ({ type: "transition", options: { type: "fade" as const } }),
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
    build: () => ({ type: "camera", movement: "pan-left" as const, options: { movement: "pan-left" as const } }),
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

  // --- text ---
  {
    pattern: /^打字效果\s*(.+)$/,
    build: (m) => ({ type: "text", text: m[1].trim(), options: { style: "typewriter" as const } }),
  },
  {
    pattern: /^(?:加文字|添加文字|加个标题)\s*(.+)$/,
    build: (m) => ({ type: "text", text: m[1].trim(), options: {} }),
  },
  {
    pattern: /^写上(.+)$/,
    build: (m) => ({ type: "text", text: m[1].trim(), options: {} }),
  },

  // --- export ---
  {
    pattern: /^(?:导出gif|导出动图|保存为gif|下载gif)$/,
    build: () => ({ type: "export_gif" }),
    skipMultiCheck: true,
  },
  {
    pattern: /^(?:导出视频|保存为视频|导出mp4|下载视频)$/,
    build: () => ({ type: "export_video" }),
    skipMultiCheck: true,
  },
  {
    pattern: /^(?:导出json|保存json|下载json)$/,
    build: () => ({ type: "export_json" }),
    skipMultiCheck: true,
  },
  {
    pattern: /^导出apng$/,
    build: () => ({ type: "export_apng" }),
    skipMultiCheck: true,
  },

  // --- undo ---
  {
    pattern: /^(?:取消|撤销|回退|撤回)$/,
    build: () => ({ type: "undo" }),
    skipMultiCheck: true,
  },

  // --- redo ---
  {
    pattern: /^(?:重做|恢复)$/,
    build: () => ({ type: "redo" }),
    skipMultiCheck: true,
  },

  // --- style ---
  {
    pattern: /^(?:霓虹风格|霓虹)$/,
    build: () => ({ type: "style", style: "neon" as StyleName }),
  },
  {
    pattern: /^(?:马卡龙|粉嫩|柔和风)$/,
    build: () => ({ type: "style", style: "pastel" as StyleName }),
    skipMultiCheck: true,
  },
  {
    pattern: /^单色风格$/,
    build: () => ({ type: "style", style: "monochrome" as StyleName }),
  },
  {
    pattern: /^(?:渐变风格|渐变风)$/,
    build: () => ({ type: "style", style: "gradient" as StyleName }),
  },
  {
    pattern: /^(?:复古风|复古风格|怀旧风)$/,
    build: () => ({ type: "style", style: "retro" as StyleName }),
  },
  {
    pattern: /^(?:简约风|极简|简约风格)$/,
    build: () => ({ type: "style", style: "minimal" as StyleName }),
  },
  {
    pattern: /^(?:大胆风格|粗犷)$/,
    build: () => ({ type: "style", style: "bold" as StyleName }),
  },
  {
    pattern: /^(?:自然风|自然风格|大地色)$/,
    build: () => ({ type: "style", style: "nature" as StyleName }),
  },
  {
    pattern: /^(?:风格列表|有什么风格|显示风格)$/,
    build: () => ({ type: "style_list" }),
    skipMultiCheck: true,
  },

  // --- help ---
  {
    pattern: /^帮助$/,
    build: () => ({ type: "help" }),
    skipMultiCheck: true,
  },

  // --- play ---
  {
    pattern: /^(?:play(?:\s*(?:it|animation))?|start\s*playing|resume(?:\s*(?:it|playing|playback))?)$/i,
    build: () => ({ type: "play" }),
    skipMultiCheck: true,
  },

  // --- pause ---
  {
    pattern: /^(?:pause(?:\s*(?:it|animation))?|stop(?:\s*playing)?)$/i,
    build: () => ({ type: "pause" }),
    skipMultiCheck: true,
  },

  // --- once ---
  {
    pattern: /^(?:play\s*(?:it\s*)?once|play\s*one\s*time|stop\s*looping|no\s*loop|once)$/i,
    build: () => ({ type: "once" }),
    skipMultiCheck: true,
  },

  // --- random ---
  {
    pattern: /^(?:random(?:\s*animation)?|surprise\s*me|give\s*me\s*something\s*random)$/i,
    build: () => ({ type: "random" }),
    skipMultiCheck: true,
  },

  // --- a11y ---
  {
    pattern: /^(?:(?:check\s*)?accessibility(?:\s*(?:audit|check))?|a11y(?:\s*check)?|wcag(?:\s*check)?)$/i,
    build: () => ({ type: "a11y" }),
    skipMultiCheck: true,
  },

  // --- fullscreen ---
  {
    pattern: /^(?:full\s*screen|fullscreen|go\s*fullscreen|maximize)$/i,
    build: () => ({ type: "fullscreen" }),
    skipMultiCheck: true,
  },

  // --- background ---
  {
    pattern: /^(?:(?:change\s*)?(?:bg|background)(?:\s*(?:color|colour)?)?\s*(?:to\s*)?)(#[0-9a-f]{3,8}|black|white|red|blue|green|yellow|orange|pink|purple|cyan|gray|grey|transparent)$/i,
    build: (m) => ({ type: "background", color: m[1].toLowerCase() }),
  },
  {
    pattern: /^(black|white|red|blue|green|yellow|orange|pink|purple|cyan|gray|grey|transparent)\s*(?:bg|background)$/i,
    build: (m) => ({ type: "background", color: m[1].toLowerCase() }),
  },

  // --- resize ---
  {
    pattern: /^(?:resize(?:\s*(?:it|to))?|make\s*it|set\s*size(?:\s*to)?)\s*(\d+)\s*[x×]\s*(\d+)$/i,
    build: (m) => ({ type: "resize", width: parseInt(m[1]), height: parseInt(m[2]) }),
  },
  {
    pattern: /^(?:resize(?:\s*(?:it|to))?|set\s*size(?:\s*to)?)\s*(\d+)\s+(\d+)$/i,
    build: (m) => ({ type: "resize", width: parseInt(m[1]), height: parseInt(m[2]) }),
  },

  // --- duplicate_layer ---
  {
    pattern: /^(?:duplicate|copy|clone)\s*layer\s+(.+)$/i,
    build: (m) => ({ type: "duplicate_layer", name: m[1].trim() }),
  },

  // --- delete_layer ---
  {
    pattern: /^(?:delete|remove)\s*layer\s+(.+)$/i,
    build: (m) => ({ type: "delete_layer", name: m[1].trim() }),
  },

  // --- rename_layer ---
  {
    pattern: /^rename\s*layer\s+(.+?)\s+to\s+(.+)$/i,
    build: (m) => ({ type: "rename_layer", oldName: m[1].trim(), newName: m[2].trim() }),
  },

  // === Chinese (zh) new patterns ===

  // --- play ---
  {
    pattern: /^(?:播放|开始播放|继续播放|继续)$/,
    build: () => ({ type: "play" }),
    skipMultiCheck: true,
  },

  // --- pause ---
  {
    pattern: /^(?:暂停|停止播放|停止)$/,
    build: () => ({ type: "pause" }),
    skipMultiCheck: true,
  },

  // --- once ---
  {
    pattern: /^(?:播放一次|播一次|不循环|单次播放)$/,
    build: () => ({ type: "once" }),
    skipMultiCheck: true,
  },

  // --- random ---
  {
    pattern: /^(?:随机|随机动画|随便来一个)$/,
    build: () => ({ type: "random" }),
    skipMultiCheck: true,
  },

  // --- a11y ---
  {
    pattern: /^(?:无障碍检查|可访问性|辅助功能检查)$/,
    build: () => ({ type: "a11y" }),
    skipMultiCheck: true,
  },

  // --- fullscreen ---
  {
    pattern: /^(?:全屏|最大化)$/,
    build: () => ({ type: "fullscreen" }),
    skipMultiCheck: true,
  },

  // --- background ---
  {
    pattern: /^(?:背景(?:颜?色?)?(?:改?为|设为|换成)?)\s*(黑色?|白色?|红色?|蓝色?|绿色?|透明|#[0-9a-f]{3,8})$/i,
    build: (m) => {
      const zhColorMap: Record<string, string> = {
        黑: "black", 黑色: "black", 白: "white", 白色: "white",
        红: "red", 红色: "red", 蓝: "blue", 蓝色: "blue",
        绿: "green", 绿色: "green", 透明: "transparent",
      };
      const color = zhColorMap[m[1]] || m[1].toLowerCase();
      return { type: "background", color };
    },
  },

  // --- resize ---
  {
    pattern: /^(?:调整大小|尺寸(?:改?为|设为)?)\s*(\d+)\s*[x×]\s*(\d+)$/,
    build: (m) => ({ type: "resize", width: parseInt(m[1]), height: parseInt(m[2]) }),
  },

  // --- duplicate_layer ---
  {
    pattern: /^(?:复制图层|克隆图层)\s*(.+)$/,
    build: (m) => ({ type: "duplicate_layer", name: m[1].trim() }),
  },

  // --- delete_layer ---
  {
    pattern: /^(?:删除图层|移除图层)\s*(.+)$/,
    build: (m) => ({ type: "delete_layer", name: m[1].trim() }),
  },

  // --- rename_layer ---
  {
    pattern: /^(?:重命名图层)\s*(.+?)\s*(?:为|到)\s*(.+)$/,
    build: (m) => ({ type: "rename_layer", oldName: m[1].trim(), newName: m[2].trim() }),
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
