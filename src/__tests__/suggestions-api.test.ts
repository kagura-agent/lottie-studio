import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/suggestion-engine", () => ({
  analyzeAnimation: vi.fn(),
}));

import { analyzeAnimation } from "@/lib/suggestion-engine";

const mockedAnalyze = vi.mocked(analyzeAnimation);

describe("POST /api/suggestions", () => {
  let POST: typeof import("@/app/api/suggestions/route").POST;

  beforeEach(async () => {
    vi.resetModules();
    mockedAnalyze.mockReset();
    const mod = await import("@/app/api/suggestions/route");
    POST = mod.POST;
  });

  it("returns dynamic suggestions when animation has context", async () => {
    mockedAnalyze.mockReturnValue([
      { emoji: "🎬", label: "Add motion", prompt: "Make it move" },
      { emoji: "🌈", label: "Add color", prompt: "Add colors" },
    ]);

    const req = new Request("http://localhost/api/suggestions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        animationJson: { layers: [{ ty: 4 }] },
        selectedLayer: null,
        messageCount: 3,
      }),
    });

    const res = await POST(req);
    const data = await res.json();

    expect(data.suggestions).toHaveLength(2);
    expect(data.suggestions[0].emoji).toBe("🎬");
    expect(mockedAnalyze).toHaveBeenCalledWith(
      { layers: [{ ty: 4 }] },
      null,
    );
  });

  it("falls back to static suggestions when no animation context", async () => {
    mockedAnalyze.mockReturnValue([]);

    const req = new Request("http://localhost/api/suggestions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ animationJson: null }),
    });

    const res = await POST(req);
    const data = await res.json();

    expect(data.suggestions).toHaveLength(4);
    expect(data.suggestions[0]).toHaveProperty("emoji");
    expect(data.suggestions[0]).toHaveProperty("label");
    expect(data.suggestions[0]).toHaveProperty("prompt");
  });

  it("falls back to static suggestions on invalid JSON body", async () => {
    const req = new Request("http://localhost/api/suggestions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not json",
    });

    const res = await POST(req);
    const data = await res.json();

    expect(data.suggestions).toHaveLength(4);
  });

  it("passes selectedLayer to analyzeAnimation", async () => {
    mockedAnalyze.mockReturnValue([
      { emoji: "✍️", label: "Animate text", prompt: "Animate text layer" },
    ]);

    const selectedLayer = { ty: 5, nm: "Title" };
    const req = new Request("http://localhost/api/suggestions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        animationJson: { layers: [selectedLayer] },
        selectedLayer,
      }),
    });

    const res = await POST(req);
    await res.json();

    expect(mockedAnalyze).toHaveBeenCalledWith(
      { layers: [selectedLayer] },
      selectedLayer,
    );
  });

  it("caps suggestions at 4", async () => {
    mockedAnalyze.mockReturnValue([
      { emoji: "1", label: "One", prompt: "one" },
      { emoji: "2", label: "Two", prompt: "two" },
      { emoji: "3", label: "Three", prompt: "three" },
      { emoji: "4", label: "Four", prompt: "four" },
      { emoji: "5", label: "Five", prompt: "five" },
    ]);

    const req = new Request("http://localhost/api/suggestions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ animationJson: { layers: [{ ty: 4 }] } }),
    });

    const res = await POST(req);
    const data = await res.json();

    expect(data.suggestions).toHaveLength(4);
  });
});
