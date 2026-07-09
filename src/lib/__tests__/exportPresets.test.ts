import { describe, it, expect, beforeEach } from "vitest";
import {
  EXPORT_PRESETS,
  SOCIAL_PRESETS,
  MESSAGING_PRESETS,
  WEB_PRESETS,
  getFormatExtension,
  getPresetFilename,
  checkPresetConstraints,
  loadCustomPresets,
  saveCustomPreset,
  deleteCustomPreset,
  type ExportPreset,
  type ExportFormat,
  type CustomPreset,
} from "../exportPresets";

describe("EXPORT_PRESETS", () => {
  it("every preset has required fields", () => {
    for (const p of EXPORT_PRESETS) {
      expect(p.id).toBeTruthy();
      expect(p.nameKey).toBeTruthy();
      expect(p.platform).toBeTruthy();
      expect(["social", "messaging", "web"]).toContain(p.category);
      expect(p.width).toBeGreaterThan(0);
      expect(p.height).toBeGreaterThan(0);
      expect(p.fps).toBeGreaterThan(0);
      expect(p.icon).toBeTruthy();
    }
  });

  it("has unique ids", () => {
    const ids = EXPORT_PRESETS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("category filters cover all presets", () => {
    const all = [...SOCIAL_PRESETS, ...MESSAGING_PRESETS, ...WEB_PRESETS];
    expect(all.length).toBe(EXPORT_PRESETS.length);
  });

  it("instagram-story matches spec", () => {
    const p = EXPORT_PRESETS.find((p) => p.id === "instagram-story")!;
    expect(p.width).toBe(1080);
    expect(p.height).toBe(1920);
    expect(p.format).toBe("mp4");
    expect(p.fps).toBe(30);
    expect(p.maxDuration).toBe(15000);
  });

  it("instagram-post matches spec", () => {
    const p = EXPORT_PRESETS.find((p) => p.id === "instagram-post")!;
    expect(p.width).toBe(1080);
    expect(p.height).toBe(1080);
    expect(p.format).toBe("mp4");
    expect(p.fps).toBe(30);
  });

  it("tiktok matches spec", () => {
    const p = EXPORT_PRESETS.find((p) => p.id === "tiktok")!;
    expect(p.width).toBe(1080);
    expect(p.height).toBe(1920);
    expect(p.format).toBe("mp4");
    expect(p.fps).toBe(30);
    expect(p.maxDuration).toBe(60000);
  });

  it("twitter-post matches spec", () => {
    const p = EXPORT_PRESETS.find((p) => p.id === "twitter-post")!;
    expect(p.width).toBe(1200);
    expect(p.height).toBe(675);
    expect(p.format).toBe("gif");
    expect(p.fps).toBe(24);
    expect(p.maxFileSize).toBe(15 * 1024 * 1024);
  });

  it("slack-emoji matches spec", () => {
    const p = EXPORT_PRESETS.find((p) => p.id === "slack-emoji")!;
    expect(p.width).toBe(128);
    expect(p.height).toBe(128);
    expect(p.format).toBe("gif");
    expect(p.fps).toBe(12);
    expect(p.maxFileSize).toBe(256 * 1024);
  });

  it("discord-emoji matches spec", () => {
    const p = EXPORT_PRESETS.find((p) => p.id === "discord-emoji")!;
    expect(p.width).toBe(128);
    expect(p.height).toBe(128);
    expect(p.format).toBe("gif");
    expect(p.fps).toBe(12);
    expect(p.maxFileSize).toBe(256 * 1024);
  });

  it("discord-sticker matches spec", () => {
    const p = EXPORT_PRESETS.find((p) => p.id === "discord-sticker")!;
    expect(p.width).toBe(320);
    expect(p.height).toBe(320);
    expect(p.format).toBe("apng");
    expect(p.fps).toBe(24);
    expect(p.maxFileSize).toBe(512 * 1024);
  });

  it("whatsapp-sticker matches spec", () => {
    const p = EXPORT_PRESETS.find((p) => p.id === "whatsapp-sticker")!;
    expect(p.width).toBe(512);
    expect(p.height).toBe(512);
    expect(p.format).toBe("webp");
    expect(p.fps).toBe(10);
    expect(p.maxFileSize).toBe(500 * 1024);
  });

  it("web-hero matches spec", () => {
    const p = EXPORT_PRESETS.find((p) => p.id === "web-hero")!;
    expect(p.width).toBe(1920);
    expect(p.height).toBe(1080);
    expect(p.format).toBe("json");
    expect(p.fps).toBe(60);
  });

  it("mobile-app matches spec", () => {
    const p = EXPORT_PRESETS.find((p) => p.id === "mobile-app")!;
    expect(p.width).toBe(375);
    expect(p.height).toBe(375);
    expect(p.format).toBe("dotlottie");
    expect(p.fps).toBe(30);
  });
});

describe("getFormatExtension", () => {
  const cases: [ExportFormat, string][] = [
    ["gif", "gif"],
    ["mp4", "mp4"],
    ["apng", "apng"],
    ["webp", "webp"],
    ["tgs", "tgs"],
    ["json", "json"],
    ["dotlottie", "lottie"],
  ];

  it.each(cases)("returns %s for format %s", (format, ext) => {
    expect(getFormatExtension(format)).toBe(ext);
  });
});

describe("getPresetFilename", () => {
  const preset: ExportPreset = {
    id: "instagram-story",
    nameKey: "exportPresets.instagramStory",
    platform: "Instagram",
    category: "social",
    width: 1080,
    height: 1920,
    format: "mp4",
    fps: 30,
    icon: "📱",
  };

  it("generates correct filename", () => {
    expect(getPresetFilename("My Animation", preset)).toBe("My Animation-instagram-story.mp4");
  });

  it("sanitizes special characters", () => {
    expect(getPresetFilename("cool<>anim", preset)).toBe("cool__anim-instagram-story.mp4");
  });

  it("uses fallback for empty name", () => {
    expect(getPresetFilename("", preset)).toBe("animation-instagram-story.mp4");
  });

  it("uses lottie extension for dotlottie format", () => {
    const dotlottiePreset: ExportPreset = { ...preset, format: "dotlottie", id: "mobile-app" };
    expect(getPresetFilename("test", dotlottiePreset)).toBe("test-mobile-app.lottie");
  });
});

describe("checkPresetConstraints", () => {
  it("returns no warnings when within limits", () => {
    const preset: ExportPreset = {
      id: "instagram-story",
      nameKey: "test",
      platform: "Instagram",
      category: "social",
      width: 1080,
      height: 1920,
      format: "mp4",
      fps: 30,
      maxDuration: 15000,
      icon: "📱",
    };
    const warnings = checkPresetConstraints(preset, 10000);
    expect(warnings).toHaveLength(0);
  });

  it("warns when duration exceeds limit", () => {
    const preset: ExportPreset = {
      id: "instagram-story",
      nameKey: "test",
      platform: "Instagram",
      category: "social",
      width: 1080,
      height: 1920,
      format: "mp4",
      fps: 30,
      maxDuration: 15000,
      icon: "📱",
    };
    const warnings = checkPresetConstraints(preset, 20000);
    expect(warnings).toHaveLength(1);
    expect(warnings[0].type).toBe("duration");
    expect(warnings[0].limit).toBe(15000);
    expect(warnings[0].current).toBe(20000);
  });

  it("returns no warnings when no constraints", () => {
    const preset: ExportPreset = {
      id: "instagram-post",
      nameKey: "test",
      platform: "Instagram",
      category: "social",
      width: 1080,
      height: 1080,
      format: "mp4",
      fps: 30,
      icon: "📷",
    };
    const warnings = checkPresetConstraints(preset, 60000);
    expect(warnings).toHaveLength(0);
  });

  it("handles zero duration gracefully", () => {
    const preset: ExportPreset = {
      id: "tiktok",
      nameKey: "test",
      platform: "TikTok",
      category: "social",
      width: 1080,
      height: 1920,
      format: "mp4",
      fps: 30,
      maxDuration: 60000,
      icon: "🎵",
    };
    const warnings = checkPresetConstraints(preset, 0);
    expect(warnings).toHaveLength(0);
  });
});

describe("custom preset localStorage", () => {
  let store: Record<string, string>;
  beforeEach(() => {
    store = {};
    const mock = {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, val: string) => { store[key] = val; },
      removeItem: (key: string) => { delete store[key]; },
      clear: () => { store = {}; },
    };
    globalThis.localStorage = mock as unknown as Storage;
  });

  it("loadCustomPresets returns empty array when no data", () => {
    expect(loadCustomPresets()).toEqual([]);
  });

  it("saveCustomPreset and loadCustomPresets round-trip", () => {
    const preset: CustomPreset = {
      id: "custom-1",
      nameKey: "My Preset",
      platform: "Custom",
      category: "social",
      width: 500,
      height: 500,
      format: "gif",
      fps: 24,
      icon: "🎨",
      custom: true,
      createdAt: Date.now(),
    };
    saveCustomPreset(preset);
    const loaded = loadCustomPresets();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].id).toBe("custom-1");
    expect(loaded[0].nameKey).toBe("My Preset");
  });

  it("deleteCustomPreset removes a preset", () => {
    const preset: CustomPreset = {
      id: "custom-del",
      nameKey: "Delete Me",
      platform: "Custom",
      category: "social",
      width: 100,
      height: 100,
      format: "gif",
      fps: 12,
      icon: "🗑️",
      custom: true,
      createdAt: Date.now(),
    };
    saveCustomPreset(preset);
    expect(loadCustomPresets()).toHaveLength(1);
    deleteCustomPreset("custom-del");
    expect(loadCustomPresets()).toHaveLength(0);
  });
});
