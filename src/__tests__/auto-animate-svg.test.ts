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

vi.mock("@/lib/svg-to-lottie", () => ({
  convertSvgToLottie: vi.fn(() => ({
    data: {
      v: "5.7.1",
      fr: 30,
      ip: 0,
      op: 60,
      w: 100,
      h: 100,
      layers: [{ ty: 4, nm: "Shape", ind: 0, ip: 0, op: 60, st: 0, ks: {} }],
    },
    warnings: [],
  })),
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

  it("handles multipart form-data upload", async () => {
    const { POST } = await import("@/app/api/import-svg/route");
    const formData = new FormData();
    const file = new File([validSvg], "icon.svg", { type: "image/svg+xml" });
    formData.append("file", file);

    const request = new Request("http://localhost:3000/api/import-svg?autoAnimate=false", {
      method: "POST",
      body: formData,
    });
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(201);
    expect(json.name).toBe("icon");
    expect(json.message).toContain("static frame ready for animation");
  });

  it("returns 400 when file is missing from form data", async () => {
    const { POST } = await import("@/app/api/import-svg/route");
    const formData = new FormData();
    formData.append("other", "value");

    const request = new Request("http://localhost:3000/api/import-svg", {
      method: "POST",
      body: formData,
    });
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toBe("No file provided");
  });

  it("returns 413 when file is too large", async () => {
    const { POST } = await import("@/app/api/import-svg/route");
    const formData = new FormData();
    const bigContent = "x".repeat(6 * 1024 * 1024);
    const file = new File([bigContent], "big.svg", { type: "image/svg+xml" });
    formData.append("file", file);

    const request = new Request("http://localhost:3000/api/import-svg", {
      method: "POST",
      body: formData,
    });
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(413);
    expect(json.error).toContain("File too large");
  });

  it("returns 400 when svg field is missing from JSON body", async () => {
    const { POST } = await import("@/app/api/import-svg/route");
    const request = new Request("http://localhost:3000/api/import-svg", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "test" }),
    });
    const response = await POST(request);
    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe("svg field is required");
  });

  it("returns 400 when svg field is not a string", async () => {
    const { POST } = await import("@/app/api/import-svg/route");
    const request = new Request("http://localhost:3000/api/import-svg", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ svg: 123 }),
    });
    const response = await POST(request);
    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe("svg field is required");
  });

  it("returns 400 for invalid SVG content", async () => {
    const response = await callRoute("this is not svg at all");
    expect(response.status).toBe(400);
    expect((await response.json()).error).toContain("Invalid SVG");
  });

  it("returns 400 when SVG conversion throws", async () => {
    const { convertSvgToLottie } = await import("@/lib/svg-to-lottie");
    vi.mocked(convertSvgToLottie).mockImplementationOnce(() => {
      throw new Error("Parse error in SVG");
    });

    const response = await callRoute(validSvg);
    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe("Parse error in SVG");
  });

  it("returns 400 with default message when conversion throws non-Error", async () => {
    const { convertSvgToLottie } = await import("@/lib/svg-to-lottie");
    vi.mocked(convertSvgToLottie).mockImplementationOnce(() => {
      throw "string error";
    });

    const response = await callRoute(validSvg);
    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe("SVG conversion failed");
  });

  it("uses singular 'layer' text for exactly 1 layer", async () => {
    const animatedLottie = {
      v: "5.7.1", fr: 30, ip: 0, op: 60, w: 100, h: 100,
      layers: [{ ty: 4, nm: "Shape", ind: 0, ip: 0, op: 60, st: 0, ks: {} }],
    };
    mockedChatCompletion.mockResolvedValueOnce({
      reply: "Animated it.",
      lottieJson: animatedLottie,
      parseError: null,
      suggestions: null,
    });

    const response = await callRoute(validSvg);
    const json = await response.json();

    expect(response.status).toBe(201);
    expect(json.message).toMatch(/1 layer\b/);
    expect(json.message).not.toMatch(/1 layers/);
  });

  it("uses default reply text when LLM reply is empty", async () => {
    const animatedLottie = {
      v: "5.7.1", fr: 30, ip: 0, op: 60, w: 100, h: 100,
      layers: [{ ty: 4, nm: "Shape", ind: 0, ip: 0, op: 60, st: 0, ks: {} }],
    };
    mockedChatCompletion.mockResolvedValueOnce({
      reply: "",
      lottieJson: animatedLottie,
      parseError: null,
      suggestions: null,
    });

    const response = await callRoute(validSvg);
    const json = await response.json();

    expect(response.status).toBe(201);
    expect(json.message).toContain("Applied contextual animations to the imported SVG.");
  });

  it("omits suggestions section when suggestions is null", async () => {
    const animatedLottie = {
      v: "5.7.1", fr: 30, ip: 0, op: 60, w: 100, h: 100,
      layers: [{ ty: 4, nm: "Shape", ind: 0, ip: 0, op: 60, st: 0, ks: {} }],
    };
    mockedChatCompletion.mockResolvedValueOnce({
      reply: "Done.",
      lottieJson: animatedLottie,
      parseError: null,
      suggestions: null,
    });

    const response = await callRoute(validSvg);
    const json = await response.json();

    expect(response.status).toBe(201);
    expect(json.message).not.toContain("Refinement suggestions");
  });

  it("omits suggestions section when suggestions array is empty", async () => {
    const animatedLottie = {
      v: "5.7.1", fr: 30, ip: 0, op: 60, w: 100, h: 100,
      layers: [{ ty: 4, nm: "Shape", ind: 0, ip: 0, op: 60, st: 0, ks: {} }],
    };
    mockedChatCompletion.mockResolvedValueOnce({
      reply: "Done.",
      lottieJson: animatedLottie,
      parseError: null,
      suggestions: [],
    });

    const response = await callRoute(validSvg);
    const json = await response.json();

    expect(response.status).toBe(201);
    expect(json.message).not.toContain("Refinement suggestions");
  });

  it("skips LLM and uses static message when layers array is empty", async () => {
    const { convertSvgToLottie } = await import("@/lib/svg-to-lottie");
    vi.mocked(convertSvgToLottie).mockReturnValueOnce({
      data: { v: "5.7.1", fr: 30, ip: 0, op: 60, w: 100, h: 100, layers: [] },
      warnings: [],
    });

    const response = await callRoute(validSvg);
    const json = await response.json();

    expect(response.status).toBe(201);
    expect(json.message).toContain("static frame ready for animation");
    expect(mockedChatCompletion).not.toHaveBeenCalled();
  });

  it("returns 500 on unexpected top-level error", async () => {
    const { convertSvgToLottie } = await import("@/lib/svg-to-lottie");
    vi.mocked(convertSvgToLottie).mockReturnValueOnce({
      data: { v: "5.7.1", fr: 30, ip: 0, op: 60, w: 100, h: 100, layers: [] },
      warnings: [],
    });
    const fs = await import("node:fs");
    vi.mocked(fs.default.writeFileSync).mockImplementationOnce(() => {
      throw new Error("disk full");
    });

    const response = await callRoute(validSvg, "?autoAnimate=false");
    const json = await response.json();

    expect(response.status).toBe(500);
    expect(json.error).toBe("disk full");
  });

  it("strips .svg extension from uploaded filename", async () => {
    const { POST } = await import("@/app/api/import-svg/route");
    const formData = new FormData();
    const file = new File([validSvg], "my-logo.SVG", { type: "image/svg+xml" });
    formData.append("file", file);

    const request = new Request("http://localhost:3000/api/import-svg?autoAnimate=false", {
      method: "POST",
      body: formData,
    });
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(201);
    expect(json.name).toBe("my-logo");
  });

  it("falls back to 'Imported SVG' when filename is just .svg", async () => {
    const { POST } = await import("@/app/api/import-svg/route");
    const formData = new FormData();
    const file = new File([validSvg], ".svg", { type: "image/svg+xml" });
    formData.append("file", file);

    const request = new Request("http://localhost:3000/api/import-svg?autoAnimate=false", {
      method: "POST",
      body: formData,
    });
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(201);
    expect(json.name).toBe("Imported SVG");
  });

  it("handles undefined layers in converted Lottie", async () => {
    const { convertSvgToLottie } = await import("@/lib/svg-to-lottie");
    vi.mocked(convertSvgToLottie).mockReturnValueOnce({
      data: { v: "5.7.1", fr: 30, ip: 0, op: 60, w: 100, h: 100 } as never,
      warnings: [],
    });

    const response = await callRoute(validSvg, "?autoAnimate=false");
    const json = await response.json();

    expect(response.status).toBe(201);
    expect(json.message).toContain("0 layers");
  });

  it("returns 500 with default message on non-Error top-level throw", async () => {
    const { convertSvgToLottie } = await import("@/lib/svg-to-lottie");
    vi.mocked(convertSvgToLottie).mockReturnValueOnce({
      data: { v: "5.7.1", fr: 30, ip: 0, op: 60, w: 100, h: 100, layers: [] },
      warnings: [],
    });
    const fs = await import("node:fs");
    vi.mocked(fs.default.writeFileSync).mockImplementationOnce(() => {
      throw "string crash";
    });

    const response = await callRoute(validSvg, "?autoAnimate=false");
    const json = await response.json();

    expect(response.status).toBe(500);
    expect(json.error).toBe("Import failed");
  });

  it("uses plural 'layers' in LLM fallback message for multiple layers", async () => {
    const { convertSvgToLottie } = await import("@/lib/svg-to-lottie");
    vi.mocked(convertSvgToLottie).mockReturnValueOnce({
      data: {
        v: "5.7.1", fr: 30, ip: 0, op: 60, w: 100, h: 100,
        layers: [
          { ty: 4, nm: "A", ind: 0, ip: 0, op: 60, st: 0, ks: {} },
          { ty: 4, nm: "B", ind: 1, ip: 0, op: 60, st: 0, ks: {} },
        ],
      },
      warnings: [],
    });
    mockedChatCompletion.mockResolvedValueOnce({
      reply: "Here",
      lottieJson: null,
      parseError: "bad",
      suggestions: null,
    });

    const response = await callRoute(validSvg);
    const json = await response.json();

    expect(response.status).toBe(201);
    expect(json.message).toMatch(/2 layers/);
    expect(json.message).toContain("Auto-animation couldn't be applied");
  });

  it("uses plural 'layers' in LLM error fallback for multiple layers", async () => {
    const { convertSvgToLottie } = await import("@/lib/svg-to-lottie");
    vi.mocked(convertSvgToLottie).mockReturnValueOnce({
      data: {
        v: "5.7.1", fr: 30, ip: 0, op: 60, w: 100, h: 100,
        layers: [
          { ty: 4, nm: "A", ind: 0, ip: 0, op: 60, st: 0, ks: {} },
          { ty: 4, nm: "B", ind: 1, ip: 0, op: 60, st: 0, ks: {} },
        ],
      },
      warnings: [],
    });
    mockedChatCompletion.mockRejectedValueOnce(new Error("timeout"));

    const response = await callRoute(validSvg);
    const json = await response.json();

    expect(response.status).toBe(201);
    expect(json.message).toMatch(/2 layers/);
    expect(json.message).toContain("Auto-animation unavailable");
  });

  it("uses singular 'layer' in LLM fallback messages for 1 layer", async () => {
    mockedChatCompletion.mockResolvedValueOnce({
      reply: "Here",
      lottieJson: null,
      parseError: "bad",
      suggestions: null,
    });

    const response = await callRoute(validSvg);
    const json = await response.json();

    expect(response.status).toBe(201);
    expect(json.message).toMatch(/1 layer\b/);
    expect(json.message).not.toMatch(/1 layers/);
  });
});
