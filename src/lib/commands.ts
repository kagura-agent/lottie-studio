// Slash command parser for chat panel

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
  | { type: "resize"; width: number; height: number }
  | { type: "background"; color: string }
  | { type: "fullscreen" }
  | { type: "optimize" }
  | { type: "help" }
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

    case "help":
    case "commands":
    case "?":
      return { type: "help" };

    default:
      return null;
  }
}
