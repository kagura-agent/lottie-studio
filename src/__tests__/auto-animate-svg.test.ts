import { describe, it, expect, vi, beforeEach } from "vitest";
import { describeLayersForLLM } from "@/app/api/import-svg/route";

// Mock dependencies
vi.mock("@/lib/llm", () => ({
  chatCompletion: vi.fn(),
}));

vi.mock("@/lib/prompts", () => ({
  buildSystemPrompt: vi.fn(() => "You are a Lottie animation expert."),
}));

vi.mock("@/lib/db", () => ({
  db: {
    prepare: vi.fn(() => ({
      run: vi.fn(),
    })),
  },
  ANIMATIONS_DIR: "/tmp/test-animations",
}));

vi.mock("node:fs", () => ({
  default: {
    writeFileSync: vi.fn(),
    existsSync: vi.fn(() => true),
    mkdirSync: vi.fn(),
  },
}));

describe("describeLayersForLLM", () => {
  it("describes shape layers correctly", () => {
    const layers = [
      { nm: "Background", ty: 4 },
      { nm: "Title", ty: 5 },
      { nm: "Container", ty: 0 },
    ];
    const result = describeLayersForLLM(layers);
    expect(result).toBe(
      '- Layer 0: "Background" (Shape)\n- Layer 1: "Title" (Text)\n- Layer 2: "Container" (Precomp)'
    );
  });

  it("handles layers without names", () => {
    const layers = [
      { ty: 4 },
      { nm: "", ty: 1 },
    ];
    const result = describeLayersForLLM(layers);
    expect(result).toBe(
      '- Layer 0: "Layer 0" (Shape)\n- Layer 1: "Layer 1" (Solid)'
    );
  });

  it("labels null layers correctly", () => {
    const layers = [{ nm: "Ctrl", ty: 3 }];
    const result = describeLayersForLLM(layers);
    expect(result).toBe('- Layer 0: "Ctrl" (Null)');
  });

  it("handles unknown layer types", () => {
    const layers = [{ nm: "Camera", ty: 13 }];
    const result = describeLayersForLLM(layers);
    expect(result).toBe('- Layer 0: "Camera" (Type 13)');
  });

  it("returns empty string for empty layers", () => {
    const result = describeLayersForLLM([]);
    expect(result).toBe("");
  });
});

describe("import-svg API route", () => {
  let mockedChatCompletion: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.clearAllMocks();
    const llm = await import("@/lib/llm");
    mockedChatCompletion = vi.mocked(llm.chatCompletion);
  });

  // Helper to call the route
  async function callRoute(svgBody: string, params = "") {
    const { POST } = await import("@/app/api/import-svg/route");
    const request = new Request(`http://localhost:3000/api/import-svg${params}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ svg: svgBody, name: "test-icon" }),
    });
    return POST(request);
  }

  const validSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="red"/></svg>`;

  it("skips LLM when autoAnimate=false", async () => {
    const response = await callRoute(validSvg, "?autoAnimate=false");
    const json = await response.json();

    expect(response.status).toBe(201);
    expect(json.id).toBeDefined();
    expect(json.name).toBe("test-icon");
    expect(json.message).toContain("static frame ready for animation");
    expect(mockedChatCompletion).not.toHaveBeenCalled();
  });

  it("falls back gracefully when LLM returns invalid JSON", async () => {
    mockedChatCompletion.mockResolvedValueOnce({
      reply: "Here is the animation",
      lottieJson: null,
      parseError: "invalid_json",
      suggestions: null,
    });

    const response = await callRoute(validSvg);
    const json = await response.json();

    expect(response.status).toBe(201);
    expect(json.id).toBeDefined();
    expect(json.message).toContain("Auto-animation couldn't be applied");
    expect(mockedChatCompletion).toHaveBeenCalledTimes(1);
  });

  it("falls back gracefully when LLM throws an error", async () => {
    mockedChatCompletion.mockRejectedValueOnce(new Error("LLM timeout"));

    const response = await callRoute(validSvg);
    const json = await response.json();

    expect(response.status).toBe(201);
    expect(json.id).toBeDefined();
    expect(json.message).toContain("Auto-animation unavailable");
    expect(mockedChatCompletion).toHaveBeenCalledTimes(1);
  });

  it("uses LLM result when auto-animate succeeds", async () => {
    const animatedLottie = {
      v: "5.7.1",
      fr: 30,
      ip: 0,
      op: 60,
      w: 100,
      h: 100,
      layers: [{ ty: 4, nm: "Rect", ind: 0, ip: 0, op: 60, st: 0, ks: {} }],
    };

    mockedChatCompletion.mockResolvedValueOnce({
      reply: "Added a fade-in animation to the rectangle.",
      lottieJson: animatedLottie,
      parseError: null,
      suggestions: ["Try adding a bounce effect"],
    });

    const response = await callRoute(validSvg);
    const json = await response.json();

    expect(response.status).toBe(201);
    expect(json.message).toContain("Imported and animated");
    expect(json.message).toContain("fade-in animation");
    expect(json.message).toContain("bounce effect");
    expect(json.data).toEqual(animatedLottie);
  });
});
