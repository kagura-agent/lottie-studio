export type ExportFormat = "gif" | "mp4" | "apng" | "webp" | "tgs" | "json" | "dotlottie";

export interface ExportPreset {
  id: string;
  nameKey: string;
  platform: string;
  category: "social" | "messaging" | "web";
  width: number;
  height: number;
  format: ExportFormat;
  fps: number;
  maxFileSize?: number;
  maxDuration?: number;
  icon: string;
}

export const EXPORT_PRESETS: ExportPreset[] = [
  {
    id: "instagram-story",
    nameKey: "exportPresets.instagramStory",
    platform: "Instagram",
    category: "social",
    width: 1080,
    height: 1920,
    format: "mp4",
    fps: 30,
    maxDuration: 15000,
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
    fps: 30,
    icon: "📷",
  },
  {
    id: "tiktok",
    nameKey: "exportPresets.tiktok",
    platform: "TikTok",
    category: "social",
    width: 1080,
    height: 1920,
    format: "mp4",
    fps: 30,
    maxDuration: 60000,
    icon: "🎵",
  },
  {
    id: "twitter-post",
    nameKey: "exportPresets.twitterPost",
    platform: "Twitter/X",
    category: "social",
    width: 1200,
    height: 675,
    format: "gif",
    fps: 24,
    maxFileSize: 15 * 1024 * 1024,
    icon: "🐦",
  },
  {
    id: "youtube-shorts",
    nameKey: "exportPresets.youtubeShorts",
    platform: "YouTube",
    category: "social",
    width: 1080,
    height: 1920,
    format: "mp4",
    fps: 30,
    icon: "▶️",
  },
  {
    id: "slack-emoji",
    nameKey: "exportPresets.slackEmoji",
    platform: "Slack",
    category: "messaging",
    width: 128,
    height: 128,
    format: "gif",
    fps: 12,
    maxFileSize: 256 * 1024,
    icon: "💬",
  },
  {
    id: "discord-emoji",
    nameKey: "exportPresets.discordEmoji",
    platform: "Discord",
    category: "messaging",
    width: 128,
    height: 128,
    format: "gif",
    fps: 12,
    maxFileSize: 256 * 1024,
    icon: "🎮",
  },
  {
    id: "discord-sticker",
    nameKey: "exportPresets.discordSticker",
    platform: "Discord",
    category: "messaging",
    width: 320,
    height: 320,
    format: "apng",
    fps: 24,
    maxFileSize: 512 * 1024,
    icon: "🏷️",
  },
  {
    id: "whatsapp-sticker",
    nameKey: "exportPresets.whatsappSticker",
    platform: "WhatsApp",
    category: "messaging",
    width: 512,
    height: 512,
    format: "webp",
    fps: 10,
    maxFileSize: 500 * 1024,
    icon: "📨",
  },
  {
    id: "telegram-sticker",
    nameKey: "exportPresets.telegramSticker",
    platform: "Telegram",
    category: "messaging",
    width: 512,
    height: 512,
    format: "tgs",
    fps: 30,
    maxFileSize: 64 * 1024,
    maxDuration: 3000,
    icon: "✈️",
  },
  {
    id: "web-hero",
    nameKey: "exportPresets.webHero",
    platform: "Web",
    category: "web",
    width: 1920,
    height: 1080,
    format: "json",
    fps: 60,
    icon: "🌐",
  },
  {
    id: "mobile-app",
    nameKey: "exportPresets.mobileApp",
    platform: "Mobile",
    category: "web",
    width: 375,
    height: 375,
    format: "dotlottie",
    fps: 30,
    icon: "📲",
  },
  {
    id: "web-banner",
    nameKey: "exportPresets.webBanner",
    platform: "Web",
    category: "web",
    width: 728,
    height: 90,
    format: "gif",
    fps: 24,
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
    fps: 12,
    icon: "🔖",
  },
];

export const SOCIAL_PRESETS = EXPORT_PRESETS.filter((p) => p.category === "social");
export const MESSAGING_PRESETS = EXPORT_PRESETS.filter((p) => p.category === "messaging");
export const WEB_PRESETS = EXPORT_PRESETS.filter((p) => p.category === "web");

export function getFormatExtension(format: ExportFormat): string {
  switch (format) {
    case "gif":
      return "gif";
    case "mp4":
      return "mp4";
    case "apng":
      return "apng";
    case "webp":
      return "webp";
    case "tgs":
      return "tgs";
    case "json":
      return "json";
    case "dotlottie":
      return "lottie";
  }
}

export function getPresetFilename(animationName: string, preset: ExportPreset): string {
  const sanitized = animationName.replace(/[^a-zA-Z0-9_\-. ]/g, "_").trim() || "animation";
  const ext = getFormatExtension(preset.format);
  return `${sanitized}-${preset.id}.${ext}`;
}

export interface CustomPreset extends ExportPreset {
  custom: true;
  createdAt: number;
}

const CUSTOM_PRESETS_KEY = "lottie-studio-custom-export-presets";

export function loadCustomPresets(): CustomPreset[] {
  try {
    const raw = localStorage.getItem(CUSTOM_PRESETS_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveCustomPreset(preset: CustomPreset): void {
  const existing = loadCustomPresets();
  const idx = existing.findIndex((p) => p.id === preset.id);
  if (idx >= 0) {
    existing[idx] = preset;
  } else {
    existing.push(preset);
  }
  localStorage.setItem(CUSTOM_PRESETS_KEY, JSON.stringify(existing));
}

export function deleteCustomPreset(id: string): void {
  const existing = loadCustomPresets().filter((p) => p.id !== id);
  localStorage.setItem(CUSTOM_PRESETS_KEY, JSON.stringify(existing));
}

export interface ConstraintWarning {
  type: "duration" | "fileSize";
  message: string;
  limit: number;
  current?: number;
}

export function checkPresetConstraints(
  preset: ExportPreset,
  animationDurationMs: number
): ConstraintWarning[] {
  const warnings: ConstraintWarning[] = [];

  if (preset.maxDuration && animationDurationMs > preset.maxDuration) {
    warnings.push({
      type: "duration",
      message: `Animation is ${(animationDurationMs / 1000).toFixed(1)}s but ${preset.platform} allows max ${(preset.maxDuration / 1000).toFixed(0)}s`,
      limit: preset.maxDuration,
      current: animationDurationMs,
    });
  }

  return warnings;
}
