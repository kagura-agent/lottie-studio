// Slash command parser for chat panel

export const VALID_STYLES = [
  "neon",
  "pastel",
  "monochrome",
  "gradient",
  "retro",
  "minimal",
  "bold",
  "nature",
] as const;

export type StyleName = (typeof VALID_STYLES)[number];

export const STYLE_DESCRIPTIONS: Record<StyleName, string> = {
  neon: "Glowing edges, electric colors (cyan/magenta/purple), dark background",
  pastel: "Soft muted pastels (light pink, baby blue, lavender, mint), gentle fills",
  monochrome: "Single-color palette with varying shades and opacities for depth",
  gradient: "Smooth gradient fills with flowing color transitions",
  retro: "Warm vintage tones (amber, burnt orange, mustard), rounded shapes",
  minimal: "Essential shapes, thin strokes, ample white space, muted colors",
  bold: "Thick strokes, highly saturated colors, high contrast",
  nature: "Earth tones (forest green, sky blue, terracotta, sand), organic curves",
};

export const VALID_ANIMATIONS = [
  "bounce",
  "pulse",
  "shake",
  "float",
  "spin",
  "slide-in",
  "fade-in",
  "elastic",
  "wiggle",
  "typewriter",
] as const;

export type AnimationPreset = (typeof VALID_ANIMATIONS)[number];

export type ThemeSubcommand =
  | { action: "set"; key: string; value: string }
  | { action: "show" }
  | { action: "clear" };

export type PresetsSubcommand =
  | "list"
  | { action: "save"; name: string; description?: string }
  | { action: "delete"; name: string }
  | { action: "rename"; oldName: string; newName: string }
  | { action: "info"; name: string };

export type Command =
  | { type: "play" }
  | { type: "pause" }
  | { type: "speed"; speed: number }
  | { type: "loop" }
  | { type: "once" }
  | { type: "export_gif" }
  | { type: "export_apng" }
  | { type: "export_video" }
  | { type: "export_json" }
  | { type: "export_dotlottie" }
  | { type: "undo" }
  | { type: "redo" }
  | { type: "duration"; durationMs: number }
  | { type: "resize"; width: number; height: number }
  | { type: "background"; color: string }
  | { type: "fullscreen" }
  | { type: "optimize" }
  | { type: "goto"; target: { value: number; unit: "frame" | "seconds" | "ms" | "percent" } }
  | { type: "style"; style: StyleName }
  | { type: "style_list" }
  | { type: "style_custom"; description: string }
  | { type: "animate"; animation: AnimationPreset }
  | { type: "marker_add"; name: string; startFrame: number; endFrame: number }
  | { type: "marker_remove"; name: string }
  | { type: "marker_list" }
  | { type: "marker_clear" }
  | { type: "import"; url: string }
  | { type: "compose"; id: string }
  | { type: "sequence_create"; name: string }
  | { type: "sequence_add"; name?: string }
  | { type: "sequence_list" }
  | { type: "sequence_show"; name: string }
  | { type: "sequence_reorder"; name: string; positions: string }
  | { type: "sequence_delete"; name: string }
  | { type: "sequence_play"; name: string }
  | { type: "theme"; subcommand: ThemeSubcommand }
  | { type: "variations"; prompt: string }
  | { type: "random" }
  | { type: "presets"; subcommand: PresetsSubcommand }
  | { type: "layers" }
  | { type: "duplicate_layer"; name: string }
  | { type: "delete_layer"; name: string }
  | { type: "rename_layer"; oldName: string; newName: string }
  | { type: "critique" }
  | { type: "polish" }
  | { type: "help" }
  | { type: "plugins_list" }
  | { type: "plugin_install"; slug: string }
  | { type: "plugin_remove"; slug: string }
  | { type: "error"; message: string };

export function parseCommand(input: string): Command | null {
  const trimmed = input.trim();
  if (!trimmed.startsWith("/")) return null;

  const parts = trimmed.slice(1).split(/\s+/);
  const cmd = parts[0].toLowerCase();
  const args = parts.slice(1);

  switch (cmd) {
    case "play":
      return { type: "play" };

    case "pause":
      return { type: "pause" };

    case "speed": {
      if (args.length === 0) {
        return { type: "error", message: "Usage: /speed <number> (e.g. /speed 2x)" };
      }
      const raw = args[0].replace(/x$/i, "");
      const n = parseFloat(raw);
      if (isNaN(n) || n <= 0) {
        return { type: "error", message: `Invalid speed value: "${args[0]}"` };
      }
      return { type: "speed", speed: n };
    }

    case "loop":
      return { type: "loop" };

    case "once":
      return { type: "once" };

    case "export": {
      if (args.length === 0) {
        return { type: "error", message: "Usage: /export gif|video|json|dotlottie" };
      }
      const format = args[0].toLowerCase();
      switch (format) {
        case "gif":
          return { type: "export_gif" };
        case "apng":
          return { type: "export_apng" };
        case "video":
          return { type: "export_video" };
        case "json":
          return { type: "export_json" };
        case "dotlottie":
          return { type: "export_dotlottie" };
        default:
          return { type: "error", message: `Unknown export format: "${args[0]}". Use gif, apng, video, json, or dotlottie.` };
      }
    }

    case "undo":
      return { type: "undo" };

    case "redo":
      return { type: "redo" };

    case "duration": {
      if (args.length === 0) {
        return { type: "error", message: "Usage: /duration <time> (e.g. /duration 2s, /duration 500ms)" };
      }
      const raw = args[0].toLowerCase();
      let ms: number;
      if (raw.endsWith("ms")) {
        ms = parseFloat(raw.slice(0, -2));
      } else if (raw.endsWith("s")) {
        ms = parseFloat(raw.slice(0, -1)) * 1000;
      } else {
        ms = parseFloat(raw) * 1000; // bare number treated as seconds
      }
      if (isNaN(ms) || ms <= 0) {
        return { type: "error", message: `Invalid duration: "${args[0]}". Use a positive value like 2s or 500ms.` };
      }
      return { type: "duration", durationMs: ms };
    }

    case "resize": {
      if (args.length === 0) {
        return { type: "error", message: "Usage: /resize <width>x<height> (e.g. /resize 800x600)" };
      }
      const match = args[0].match(/^(\d+)x(\d+)$/i);
      if (!match) {
        return { type: "error", message: `Invalid resize format: "${args[0]}". Use WxH (e.g. 800x600).` };
      }
      const width = parseInt(match[1], 10);
      const height = parseInt(match[2], 10);
      if (width <= 0 || height <= 0) {
        return { type: "error", message: "Width and height must be positive numbers." };
      }
      return { type: "resize", width, height };
    }

    case "bg":
    case "background": {
      if (args.length === 0) {
        return { type: "error", message: "Usage: /bg <color> (e.g. /bg #ff0000)" };
      }
      return { type: "background", color: args[0] };
    }

    case "fullscreen":
      return { type: "fullscreen" };

    case "optimize":
      return { type: "optimize" };

    case "goto": {
      if (args.length === 0) {
        return { type: "error", message: "Usage: /goto <target> (e.g. /goto 30, /goto 1.5s, /goto 50%)" };
      }
      const raw = args[0].toLowerCase();
      let value: number;
      let unit: "frame" | "seconds" | "ms" | "percent";
      if (raw.endsWith("%")) {
        value = parseFloat(raw.slice(0, -1));
        unit = "percent";
        if (isNaN(value) || value < 0 || value > 100) {
          return { type: "error", message: `Invalid goto target: "${args[0]}". Percentage must be 0-100.` };
        }
      } else if (raw.endsWith("ms")) {
        value = parseFloat(raw.slice(0, -2));
        unit = "ms";
        if (isNaN(value) || value < 0) {
          return { type: "error", message: `Invalid goto target: "${args[0]}". Time must be non-negative.` };
        }
      } else if (raw.endsWith("s")) {
        value = parseFloat(raw.slice(0, -1));
        unit = "seconds";
        if (isNaN(value) || value < 0) {
          return { type: "error", message: `Invalid goto target: "${args[0]}". Time must be non-negative.` };
        }
      } else {
        value = parseFloat(raw);
        unit = "frame";
        if (isNaN(value) || value < 0 || !Number.isFinite(value)) {
          return { type: "error", message: `Invalid goto target: "${args[0]}". Frame must be a non-negative number.` };
        }
      }
      return { type: "goto", target: { value, unit } };
    }

    case "style": {
      if (args.length === 0) {
        return { type: "style_list" };
      }
      const styleName = args[0].toLowerCase();
      if (VALID_STYLES.includes(styleName as StyleName)) {
        return { type: "style", style: styleName as StyleName };
      }
      return { type: "style_custom", description: args.join(" ") };
    }

    case "animate": {
      if (args.length === 0) {
        return { type: "error", message: `Usage: /animate <preset>. Available presets: ${VALID_ANIMATIONS.join(", ")}` };
      }
      const animName = args[0].toLowerCase();
      if (VALID_ANIMATIONS.includes(animName as AnimationPreset)) {
        return { type: "animate", animation: animName as AnimationPreset };
      }
      return { type: "error", message: `Unknown animation preset "${args[0]}". Available presets: ${VALID_ANIMATIONS.join(", ")}` };
    }

    case "marker": {
      if (args.length === 0) {
        return { type: "error", message: "Usage: /marker add <name> <start>-<end> | /marker remove <name> | /marker list | /marker clear" };
      }
      const subcommand = args[0].toLowerCase();
      switch (subcommand) {
        case "add": {
          if (args.length < 3) {
            return { type: "error", message: "Usage: /marker add <name> <startFrame>-<endFrame>" };
          }
          const markerName = args[1];
          const rangeStr = args[2];
          const rangeMatch = rangeStr.match(/^(\d+)-(\d+)$/);
          if (!rangeMatch) {
            return { type: "error", message: `Invalid frame range: "${rangeStr}". Use format: <start>-<end> (e.g. 0-30)` };
          }
          const startFrame = parseInt(rangeMatch[1], 10);
          const endFrame = parseInt(rangeMatch[2], 10);
          if (startFrame >= endFrame) {
            return { type: "error", message: `Start frame must be less than end frame. Got ${startFrame}-${endFrame}.` };
          }
          return { type: "marker_add", name: markerName, startFrame, endFrame };
        }
        case "remove":
        case "delete": {
          if (args.length < 2) {
            return { type: "error", message: "Usage: /marker remove <name>" };
          }
          return { type: "marker_remove", name: args[1] };
        }
        case "list":
          return { type: "marker_list" };
        case "clear":
          return { type: "marker_clear" };
        default:
          return { type: "error", message: `Unknown marker subcommand: "${subcommand}". Use add, remove, list, or clear.` };
      }
    }

    case "import": {
      if (args.length === 0) {
        return { type: "error", message: "Usage: /import <url> (e.g. /import https://lottie.host/abc/animation.json)" };
      }
      const url = args.join(" ");
      try {
        const parsed = new URL(url);
        if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
          return { type: "error", message: "URL must use http or https protocol." };
        }
        return { type: "import", url: parsed.href };
      } catch {
        return { type: "error", message: `Invalid URL: "${url}". Provide a valid http/https URL.` };
      }
    }

    case "compose": {
      if (args.length === 0) {
        return { type: "error", message: "Usage: /compose <animation-id>" };
      }
      return { type: "compose", id: args[0] };
    }

    case "sequence": {
      if (args.length === 0) {
        return { type: "error", message: "Usage: /sequence create|add|list|show|play|reorder|delete" };
      }
      const sub = args[0].toLowerCase();
      switch (sub) {
        case "create": {
          if (args.length < 2) {
            return { type: "error", message: "Usage: /sequence create <name>" };
          }
          const name = args.slice(1).join(" ");
          return { type: "sequence_create", name };
        }
        case "add": {
          const name = args.length > 1 ? args.slice(1).join(" ") : undefined;
          return { type: "sequence_add", name };
        }
        case "list":
          return { type: "sequence_list" };
        case "show": {
          if (args.length < 2) {
            return { type: "error", message: "Usage: /sequence show <name>" };
          }
          const name = args.slice(1).join(" ");
          return { type: "sequence_show", name };
        }
        case "reorder": {
          if (args.length < 3) {
            return { type: "error", message: "Usage: /sequence reorder <name> <positions>" };
          }
          const name = args[1];
          const positions = args.slice(2).join(" ");
          return { type: "sequence_reorder", name, positions };
        }
        case "delete": {
          if (args.length < 2) {
            return { type: "error", message: "Usage: /sequence delete <name>" };
          }
          const name = args.slice(1).join(" ");
          return { type: "sequence_delete", name };
        }
        case "play": {
          if (args.length < 2) {
            return { type: "error", message: "Usage: /sequence play <name>" };
          }
          const name = args.slice(1).join(" ");
          return { type: "sequence_play", name };
        }
        default:
          return { type: "error", message: `Unknown sequence subcommand "${sub}". Use create, add, list, show, play, reorder, or delete.` };
      }
    }

    case "theme": {
      if (args.length === 0) {
        return { type: "theme", subcommand: { action: "show" } };
      }
      const sub = args[0].toLowerCase();
      switch (sub) {
        case "show":
          return { type: "theme", subcommand: { action: "show" } };
        case "clear":
        case "reset":
          return { type: "theme", subcommand: { action: "clear" } };
        case "set": {
          if (args.length < 3) {
            return { type: "error", message: "Usage: /theme set <key> <value> (e.g. /theme set primary #3B82F6)" };
          }
          const key = args[1].toLowerCase();
          const validKeys = ["primary", "secondary", "accent", "background", "font"];
          if (!validKeys.includes(key)) {
            return { type: "error", message: `Invalid theme key "${args[1]}". Valid keys: ${validKeys.join(", ")}` };
          }
          const value = args.slice(2).join(" ");
          return { type: "theme", subcommand: { action: "set", key, value } };
        }
        default:
          return { type: "error", message: `Unknown theme subcommand "${sub}". Use set, show, or clear.` };
      }
    }

    case "variations": {
      const prompt = args.join(" ").trim();
      if (!prompt) {
        return { type: "error", message: "Usage: /variations <prompt> (e.g. /variations a bouncing ball)" };
      }
      return { type: "variations", prompt };
    }

    case "random":
      return { type: "random" };

    case "presets":
    case "preset": {
      if (args.length === 0 || args[0].toLowerCase() === "list") {
        return { type: "presets", subcommand: "list" };
      }
      const sub = args[0].toLowerCase();
      if (sub === "save") {
        if (args.length < 2) {
          return { type: "error", message: "Usage: /presets save <name> [description...]" };
        }
        const name = args[1].toLowerCase();
        const description = args.length > 2 ? args.slice(2).join(" ") : undefined;
        return { type: "presets", subcommand: { action: "save", name, description } };
      }
      if (sub === "delete" || sub === "remove") {
        if (args.length < 2) {
          return { type: "error", message: "Usage: /presets delete <name>" };
        }
        const name = args[1].toLowerCase();
        return { type: "presets", subcommand: { action: "delete", name } };
      }
      if (sub === "rename") {
        if (args.length < 3) {
          return { type: "error", message: "Usage: /presets rename <old-name> <new-name>" };
        }
        const oldName = args[1].toLowerCase();
        const newName = args[2].toLowerCase();
        return { type: "presets", subcommand: { action: "rename", oldName, newName } };
      }
      if (sub === "info" || sub === "show") {
        if (args.length < 2) {
          return { type: "error", message: "Usage: /presets info <name>" };
        }
        const name = args[1].toLowerCase();
        return { type: "presets", subcommand: { action: "info", name } };
      }
      return { type: "error", message: `Unknown presets subcommand "${args[0]}". Use list, save, delete, rename, or info.` };
    }

    case "layers":
      return { type: "layers" };

    case "duplicate-layer": {
      const nameArg = parseQuotedArg(args);
      if (!nameArg) {
        return { type: "error", message: "Usage: /duplicate-layer <name> (use quotes for names with spaces)" };
      }
      return { type: "duplicate_layer", name: nameArg };
    }

    case "delete-layer": {
      const nameArg = parseQuotedArg(args);
      if (!nameArg) {
        return { type: "error", message: "Usage: /delete-layer <name> (use quotes for names with spaces)" };
      }
      return { type: "delete_layer", name: nameArg };
    }

    case "rename-layer": {
      const parsed = parseTwoQuotedArgs(args);
      if (!parsed) {
        return { type: "error", message: "Usage: /rename-layer <old-name> <new-name> (use quotes for names with spaces)" };
      }
      return { type: "rename_layer", oldName: parsed.first, newName: parsed.second };
    }

    case "critique":
      return { type: "critique" };

    case "polish":
      return { type: "polish" };

    case "help":
    case "commands":
    case "?":
      return { type: "help" };

    case "plugins":
      return { type: "plugins_list" };

    case "plugin": {
      if (args.length === 0) {
        return { type: "error", message: "Usage: /plugin install <slug> | /plugin remove <slug>" };
      }
      const sub = args[0].toLowerCase();
      if (sub === "install") {
        if (args.length < 2) {
          return { type: "error", message: "Usage: /plugin install <slug>" };
        }
        return { type: "plugin_install", slug: args[1] };
      }
      if (sub === "remove" || sub === "uninstall") {
        if (args.length < 2) {
          return { type: "error", message: "Usage: /plugin remove <slug>" };
        }
        return { type: "plugin_remove", slug: args[1] };
      }
      return { type: "error", message: `Unknown plugin subcommand "${sub}". Use install or remove.` };
    }

    default:
      return null;
  }
}

/**
 * Parse a single argument that may be quoted.
 * Examples: `["My Layer"]` → `"My Layer"`, `["Background"]` → `"Background"`
 */
function parseQuotedArg(args: string[]): string | null {
  if (args.length === 0) return null;
  const joined = args.join(" ");
  // Check for quoted string
  const quoteMatch = joined.match(/^(["'])(.+?)\1(?:\s|$)/);
  if (quoteMatch) return quoteMatch[2];
  // Unquoted: take the whole remaining text as the name
  return joined.trim() || null;
}

/**
 * Parse two arguments that may each be quoted.
 * Examples:
 *   `["\"Old Name\"", "\"New Name\""]` → `{ first: "Old Name", second: "New Name" }`
 *   `["oldName", "newName"]` → `{ first: "oldName", second: "newName" }`
 */
function parseTwoQuotedArgs(args: string[]): { first: string; second: string } | null {
  if (args.length === 0) return null;
  const joined = args.join(" ").trim();
  if (!joined) return null;

  let first: string;
  let rest: string;

  // Check if first arg is quoted
  const firstQuoteMatch = joined.match(/^(["'])(.+?)\1\s+(.+)$/);
  if (firstQuoteMatch) {
    first = firstQuoteMatch[2];
    rest = firstQuoteMatch[3];
  } else {
    // Unquoted first arg: take first whitespace-delimited token
    const spaceIdx = joined.indexOf(" ");
    if (spaceIdx === -1) return null; // need two args
    first = joined.slice(0, spaceIdx);
    rest = joined.slice(spaceIdx + 1).trim();
  }

  if (!rest) return null;

  // Check if second arg is quoted
  const secondQuoteMatch = rest.match(/^(["'])(.+?)\1$/);
  if (secondQuoteMatch) {
    return { first, second: secondQuoteMatch[2] };
  }

  // Unquoted second arg: take the rest
  return { first, second: rest };
}
