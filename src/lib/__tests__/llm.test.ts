import { describe, it, expect } from "vitest";
import { parseResponse } from "../llm";

describe("parseResponse", () => {
  it("extracts reply text and valid Lottie JSON", () => {
    const content = `Here is a bouncing ball.

\`\`\`json
{"v":"5.7.1","fr":30,"ip":0,"op":60,"w":512,"h":512,"layers":[{"ty":4,"nm":"Ball"}]}
\`\`\`

Enjoy!`;
    const result = parseResponse(content);
    expect(result.reply).toContain("bouncing ball");
    expect(result.reply).toContain("Enjoy!");
    expect(result.reply).not.toContain("```json");
    expect(result.lottieJson).not.toBeNull();
    expect((result.lottieJson as Record<string, unknown>).v).toBe("5.7.1");
    expect(result.parseError).toBeNull();
  });

  it("returns no_json when there is no JSON code block", () => {
    const content = "I can help you create animations!";
    const result = parseResponse(content);
    expect(result.reply).toBe("I can help you create animations!");
    expect(result.lottieJson).toBeNull();
    expect(result.parseError).toBe("no_json");
  });

  it("returns invalid_json when JSON is malformed", () => {
    const content = `Here:\n\`\`\`json\n{invalid json content\n\`\`\``;
    const result = parseResponse(content);
    expect(result.lottieJson).toBeNull();
    expect(result.parseError).toBe("invalid_json");
  });

  it("returns invalid_lottie when JSON is valid but missing 'v'", () => {
    const content = `Check this:\n\`\`\`json\n{"layers":[{"ty":4}]}\n\`\`\``;
    const result = parseResponse(content);
    expect(result.lottieJson).toBeNull();
    expect(result.parseError).toBe("invalid_lottie");
  });

  it("returns invalid_lottie when JSON is valid but missing 'layers'", () => {
    const content = `Check:\n\`\`\`json\n{"v":"5.7.1","fr":30}\n\`\`\``;
    const result = parseResponse(content);
    expect(result.lottieJson).toBeNull();
    expect(result.parseError).toBe("invalid_lottie");
  });

  it("extracts suggestions array when present", () => {
    const content = `Here is a circle.

\`\`\`json
{"v":"5.7.1","fr":30,"ip":0,"op":60,"w":512,"h":512,"layers":[{"ty":4}]}
\`\`\`

SUGGESTIONS: ["Add a shadow","Change color","Speed up"]`;
    const result = parseResponse(content);
    expect(result.suggestions).toEqual(["Add a shadow", "Change color", "Speed up"]);
    expect(result.parseError).toBeNull();
    expect(result.lottieJson).not.toBeNull();
  });

  it("strips SUGGESTIONS line from reply text", () => {
    const content = `Here is a circle.

\`\`\`json
{"v":"5.7.1","fr":30,"ip":0,"op":60,"w":512,"h":512,"layers":[{"ty":4}]}
\`\`\`

SUGGESTIONS: ["Add a shadow","Change color"]`;
    const result = parseResponse(content);
    expect(result.reply).not.toContain("SUGGESTIONS:");
  });

  it("returns null suggestions when SUGGESTIONS line is absent", () => {
    const content = `Hello!\n\`\`\`json\n{"v":"5.7.1","layers":[{"ty":4}]}\n\`\`\``;
    const result = parseResponse(content);
    expect(result.suggestions).toBeNull();
  });

  it("returns null suggestions when no_json (even if SUGGESTIONS present)", () => {
    const content = "Just text\nSUGGESTIONS: [\"a\",\"b\"]";
    const result = parseResponse(content);
    expect(result.parseError).toBe("no_json");
    // The function returns suggestions: null when parseError is no_json
    expect(result.suggestions).toBeNull();
  });

  it("handles empty response", () => {
    const result = parseResponse("");
    expect(result.reply).toBe("");
    expect(result.lottieJson).toBeNull();
    expect(result.parseError).toBe("no_json");
    expect(result.suggestions).toBeNull();
  });

  it("handles markdown without code blocks", () => {
    const content = "## Heading\n\n- bullet 1\n- bullet 2\n\nSome **bold** text.";
    const result = parseResponse(content);
    expect(result.reply).toBe(content);
    expect(result.lottieJson).toBeNull();
    expect(result.parseError).toBe("no_json");
  });

  it("extracts the first json code block when multiple exist", () => {
    const content = `First block:
\`\`\`json
{"v":"5.7.1","layers":[{"ty":4}]}
\`\`\`

Second block:
\`\`\`json
{"v":"5.7.1","layers":[{"ty":5}]}
\`\`\``;
    const result = parseResponse(content);
    expect(result.lottieJson).not.toBeNull();
    // Should match the first block (ty:4)
    const layers = (result.lottieJson as Record<string, unknown>).layers as Array<Record<string, unknown>>;
    expect(layers[0].ty).toBe(4);
  });

  it("provides default reply text when reply is empty after stripping JSON", () => {
    const content = `\`\`\`json\n{"v":"5.7.1","layers":[{"ty":4}]}\n\`\`\``;
    const result = parseResponse(content);
    expect(result.reply).toBe("Here's the animation.");
    expect(result.lottieJson).not.toBeNull();
    expect(result.parseError).toBeNull();
  });

  it("ignores malformed SUGGESTIONS JSON", () => {
    const content = `Text\n\`\`\`json\n{"v":"5.7.1","layers":[{"ty":4}]}\n\`\`\`\nSUGGESTIONS: [broken`;
    const result = parseResponse(content);
    // Malformed suggestions should be ignored
    expect(result.suggestions).toBeNull();
  });

  it("ignores SUGGESTIONS with non-string items", () => {
    const content = `Text\n\`\`\`json\n{"v":"5.7.1","layers":[{"ty":4}]}\n\`\`\`\nSUGGESTIONS: [1, 2, 3]`;
    const result = parseResponse(content);
    expect(result.suggestions).toBeNull();
  });
});
