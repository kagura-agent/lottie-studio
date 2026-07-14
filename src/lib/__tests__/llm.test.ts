import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
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

  // --- COMMAND detection tests ---

  it("detects COMMAND line and returns command object", () => {
    const content = `COMMAND: {"type": "pause"}
⏸️ Paused the animation.`;
    const result = parseResponse(content);
    expect(result.command).toEqual({ type: "pause" });
    expect(result.reply).toBe("⏸️ Paused the animation.");
    expect(result.lottieJson).toBeNull();
    expect(result.parseError).toBeNull();
  });

  it("detects COMMAND with parameters", () => {
    const content = `COMMAND: {"type": "speed", "speed": 2}
⚡ Doubled the playback speed.`;
    const result = parseResponse(content);
    expect(result.command).toEqual({ type: "speed", speed: 2 });
    expect(result.reply).toBe("⚡ Doubled the playback speed.");
    expect(result.parseError).toBeNull();
  });

  it("detects COMMAND with resize params", () => {
    const content = `COMMAND: {"type": "resize", "width": 800, "height": 600}
🔲 Resized to 800×600.`;
    const result = parseResponse(content);
    expect(result.command).toEqual({ type: "resize", width: 800, height: 600 });
    expect(result.reply).toContain("Resized");
  });

  it("returns default reply when COMMAND has no text after it", () => {
    const content = `COMMAND: {"type": "play"}`;
    const result = parseResponse(content);
    expect(result.command).toEqual({ type: "play" });
    expect(result.reply).toBe("Done.");
    expect(result.parseError).toBeNull();
  });

  it("falls through to normal parsing when COMMAND JSON is malformed", () => {
    const content = `COMMAND: {invalid json}
Some text here`;
    const result = parseResponse(content);
    expect(result.command).toBeUndefined();
    expect(result.parseError).toBe("no_json");
  });

  it("falls through when COMMAND object has no type field", () => {
    const content = `COMMAND: {"action": "pause"}
Some text`;
    const result = parseResponse(content);
    expect(result.command).toBeUndefined();
    expect(result.parseError).toBe("no_json");
  });

  it("prioritizes COMMAND over JSON code blocks", () => {
    const content = `COMMAND: {"type": "export_gif"}
📦 Exporting as GIF...
\`\`\`json
{"v":"5.7.1","layers":[{"ty":4}]}
\`\`\``;
    const result = parseResponse(content);
    expect(result.command).toEqual({ type: "export_gif" });
    expect(result.lottieJson).toBeNull();
  });
});

describe("chatCompletion", () => {
  let chatCompletion: typeof import("../llm").chatCompletion;

  beforeEach(async () => {
    vi.stubEnv("LLM_API_URL", "http://test-llm:8000/v1");
    vi.stubEnv("LLM_MODEL", "test-model");
    vi.stubEnv("LLM_API_KEY", "test-key");
    vi.stubGlobal("fetch", vi.fn());
    // Re-import to pick up env vars
    vi.resetModules();
    const mod = await import("../llm");
    chatCompletion = mod.chatCompletion;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("returns parsed LLMResponse on successful response with valid JSON", async () => {
    const mockResponse = {
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: `Here's a ball.\n\n\`\`\`json\n{"v":"5.7.1","fr":30,"ip":0,"op":60,"w":512,"h":512,"layers":[{"ty":4}]}\n\`\`\``,
            },
          },
        ],
      }),
    };
    vi.mocked(fetch).mockResolvedValue(mockResponse as unknown as Response);

    const result = await chatCompletion([{ role: "user", content: "make a ball" }]);
    expect(result.lottieJson).not.toBeNull();
    expect(result.parseError).toBeNull();
    expect(result.reply).toContain("ball");
  });

  it("throws with status and body text on HTTP error", async () => {
    const mockResponse = {
      ok: false,
      status: 500,
      text: async () => "Internal Server Error",
    };
    vi.mocked(fetch).mockResolvedValue(mockResponse as unknown as Response);

    await expect(chatCompletion([{ role: "user", content: "hi" }])).rejects.toThrow(
      "LLM API error 500: Internal Server Error"
    );
  });

  it("returns empty content handled by parseResponse when choices array is empty", async () => {
    const mockResponse = {
      ok: true,
      json: async () => ({ choices: [] }),
    };
    vi.mocked(fetch).mockResolvedValue(mockResponse as unknown as Response);

    const result = await chatCompletion([{ role: "user", content: "hi" }]);
    expect(result.reply).toBe("");
    expect(result.lottieJson).toBeNull();
    expect(result.parseError).toBe("no_json");
  });
});

describe("chatCompletionStream", () => {
  let chatCompletionStream: typeof import("../llm").chatCompletionStream;

  beforeEach(async () => {
    vi.stubEnv("LLM_API_URL", "http://test-llm:8000/v1");
    vi.stubEnv("LLM_MODEL", "test-model");
    vi.stubEnv("LLM_API_KEY", "test-key");
    vi.stubGlobal("fetch", vi.fn());
    vi.resetModules();
    const mod = await import("../llm");
    chatCompletionStream = mod.chatCompletionStream;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("returns the Response object on success", async () => {
    const mockResponse = { ok: true, body: "stream-body" };
    vi.mocked(fetch).mockResolvedValue(mockResponse as unknown as Response);

    const result = await chatCompletionStream([{ role: "user", content: "hi" }]);
    expect(result).toBe(mockResponse);
  });

  it("throws on HTTP error", async () => {
    const mockResponse = {
      ok: false,
      status: 429,
      text: async () => "Rate limited",
    };
    vi.mocked(fetch).mockResolvedValue(mockResponse as unknown as Response);

    await expect(chatCompletionStream([{ role: "user", content: "hi" }])).rejects.toThrow(
      "LLM API error 429: Rate limited"
    );
  });

  it("passes custom temperature option through to fetch body", async () => {
    const mockResponse = { ok: true };
    vi.mocked(fetch).mockResolvedValue(mockResponse as unknown as Response);

    await chatCompletionStream([{ role: "user", content: "hi" }], { temperature: 0.2 });

    const callBody = JSON.parse(vi.mocked(fetch).mock.calls[0][1]!.body as string);
    expect(callBody.temperature).toBe(0.2);
  });
});

describe("chatCompletionRepairStream", () => {
  let chatCompletionRepairStream: typeof import("../llm").chatCompletionRepairStream;

  beforeEach(async () => {
    vi.stubEnv("LLM_API_URL", "http://test-llm:8000/v1");
    vi.stubEnv("LLM_MODEL", "test-model");
    vi.stubEnv("LLM_API_KEY", "test-key");
    vi.stubGlobal("fetch", vi.fn());
    vi.resetModules();
    const mod = await import("../llm");
    chatCompletionRepairStream = mod.chatCompletionRepairStream;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("builds correct repair message array and returns Response", async () => {
    const mockResponse = { ok: true, body: "stream" };
    vi.mocked(fetch).mockResolvedValue(mockResponse as unknown as Response);

    const originalMessages = [{ role: "user" as const, content: "make a ball" }];
    const result = await chatCompletionRepairStream(originalMessages, "bad response", "invalid_json");

    expect(result).toBe(mockResponse);

    const callBody = JSON.parse(vi.mocked(fetch).mock.calls[0][1]!.body as string);
    expect(callBody.messages).toHaveLength(3);
    expect(callBody.messages[0]).toEqual({ role: "user", content: "make a ball" });
    expect(callBody.messages[1]).toEqual({ role: "assistant", content: "bad response" });
    expect(callBody.messages[2].role).toBe("user");
    expect(callBody.messages[2].content).toContain("malformed");
    expect(callBody.temperature).toBe(0.5);
    expect(callBody.stream).toBe(true);
  });

  it("throws on HTTP error", async () => {
    const mockResponse = {
      ok: false,
      status: 503,
      text: async () => "Service Unavailable",
    };
    vi.mocked(fetch).mockResolvedValue(mockResponse as unknown as Response);

    await expect(
      chatCompletionRepairStream([{ role: "user", content: "hi" }], "bad", "no_json")
    ).rejects.toThrow("LLM API error 503: Service Unavailable");
  });
});

describe("Header construction", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("includes Authorization header when LLM_API_KEY is set", async () => {
    vi.stubEnv("LLM_API_URL", "http://test-llm:8000/v1");
    vi.stubEnv("LLM_MODEL", "test-model");
    vi.stubEnv("LLM_API_KEY", "my-secret-key");
    vi.stubGlobal("fetch", vi.fn());
    vi.resetModules();

    const mockResponse = { ok: true, json: async () => ({ choices: [] }) };
    vi.mocked(fetch).mockResolvedValue(mockResponse as unknown as Response);

    const { chatCompletion: fn } = await import("../llm");
    await fn([{ role: "user", content: "hi" }]);

    const headers = vi.mocked(fetch).mock.calls[0][1]!.headers as Record<string, string>;
    expect(headers["Authorization"]).toBe("Bearer my-secret-key");
  });

  it("omits Authorization header when LLM_API_KEY is empty", async () => {
    vi.stubEnv("LLM_API_URL", "http://test-llm:8000/v1");
    vi.stubEnv("LLM_MODEL", "test-model");
    vi.stubEnv("LLM_API_KEY", "");
    vi.stubGlobal("fetch", vi.fn());
    vi.resetModules();

    const mockResponse = { ok: true, json: async () => ({ choices: [] }) };
    vi.mocked(fetch).mockResolvedValue(mockResponse as unknown as Response);

    const { chatCompletion: fn } = await import("../llm");
    await fn([{ role: "user", content: "hi" }]);

    const headers = vi.mocked(fetch).mock.calls[0][1]!.headers as Record<string, string>;
    expect(headers["Authorization"]).toBeUndefined();
  });
});
