/**
 * Social media and platform export presets.
 * Each preset specifies target dimensions, format, and optional file size limits.
 */

export type ExportFormat = "gif" | "mp4" | "apng" | "webp";

export interface ExportPreset {
  /** Unique identifier for the preset */
  id: string;
  /** i18n key for the preset name */
  nameKey: string;
  /** Platform name for display */
  platform: string;
  /** Category grouping */
  category: "social" | "web";
  /** Target width in pixels */
  width: number;
  /** Target height in pixels */
  height: number;
  /** Preferred export format */
  format: ExportFormat;
  /** Maximum file size in bytes (optional — triggers iterative quality reduction) */
  maxFileSize?: number;
  /** Maximum duration in milliseconds (optional) */
  maxDuration?: number;
  /** Icon emoji for UI */
  icon: string;
}

export const EXPORT_PRESETS: ExportPreset[] = [
  // Social Media Presets
  {
    id: "instagram-story",
    nameKey: "exportPresets.instagramStory",
    platform: "Instagram",
    category: "social",
    width: 1080,
    height: 1920,
    format: "mp4",
    icon: "📱",
  },
  {
    id: "instagram-post",
    nameKey: "exportPresets.instagramPost",
    platform: "Instagram",
    category: "social",
    width: 1080,
    height: 1080,
    format: "mp4",
    icon: "📷",
  },
  {
    id: "twitter-post",
    nameKey: "exportPresets.twitterPost",
    platform: "Twitter/X",
    category: "social",
    width: 1200,
    height: 675,
    format: "gif",
    maxFileSize: 15 * 1024 * 1024, // 15MB
    icon: "🐦",
  },
  {
    id: "tiktok",
    nameKey: "exportPresets.tiktok",
    platform: "TikTok",
    category: "social",
    width: 1080,
    height: 1920,
    format: "mp4",
    icon: "🎵",
  },
  {
    id: "youtube-shorts",
    nameKey: "exportPresets.youtubeShorts",
    platform: "YouTube",
    category: "social",
    width: 1080,
    height: 1920,
    format: "mp4",
    icon: "▶️",
  },
  {
    id: "discord-emoji",
    nameKey: "exportPresets.discordEmoji",
    platform: "Discord",
    category: "social",
    width: 128,
    height: 128,
    format: "gif",
    maxFileSize: 256 * 1024, // 256KB
    icon: "🎮",
  },
  {
    id: "slack-emoji",
    nameKey: "exportPresets.slackEmoji",
    platform: "Slack",
    category: "social",
    width: 128,
    height: 128,
    format: "gif",
    maxFileSize: 128 * 1024, // 128KB
    icon: "💬",
  },
  {
    id: "whatsapp-sticker",
    nameKey: "exportPresets.whatsappSticker",
    platform: "WhatsApp",
    category: "social",
    width: 512,
    height: 512,
    format: "apng",
    icon: "📨",
  },
  // Web Presets
  {
    id: "web-banner",
    nameKey: "exportPresets.webBanner",
    platform: "Web",
    category: "web",
    width: 728,
    height: 90,
    format: "gif",
    icon: "🖥️",
  },
  {
    id: "favicon",
    nameKey: "exportPresets.favicon",
    platform: "Web",
    category: "web",
    width: 32,
    height: 32,
    format: "gif",
    icon: "🔖",
  },
];

export const SOCIAL_PRESETS = EXPORT_PRESETS.filter((p) => p.category === "social");
export const WEB_PRESETS = EXPORT_PRESETS.filter((p) => p.category === "web");

/**
 * Get the file extension for a given export format.
 */
export function getFormatExtension(format: ExportFormat): string {
  switch (format) {
    case "gif":
      return "gif";
    case "mp4":
      return "webm"; // Browser MediaRecorder outputs WebM
    case "apng":
      return "apng";
    case "webp":
      return "webp";
  }
}

/**
 * Build a download filename for a preset export.
 * e.g., "my-animation-instagram-story.gif"
 */
export function getPresetFilename(animationName: string, preset: ExportPreset): string {
  const sanitized = animationName.replace(/[^a-zA-Z0-9_\-. ]/g, "_").trim() || "animation";
  const ext = getFormatExtension(preset.format);
  return `${sanitized}-${preset.id}.${ext}`;
}
