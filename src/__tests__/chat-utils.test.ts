import { describe, it, expect } from "vitest";
import {
  isUndoIntent,
  compactHistory,
  HISTORY_CAP,
  type MessageRow,
} from "@/lib/chat-utils";

describe("isUndoIntent", () => {
  it("returns true for exact matches", () => {
    const exactMatches = [
      "undo",
      "revert",
      "go back",
      "撤销",
      "回退",
      "撤回",
      "undo that",
      "undo last change",
      "revert to previous",
      "undo last",
    ];
    for (const msg of exactMatches) {
      expect(isUndoIntent(msg)).toBe(true);
    }
  });

  it("returns true for short messages with generic suffixes", () => {
    expect(isUndoIntent("undo this")).toBe(true);
    expect(isUndoIntent("revert it")).toBe(true);
    expect(isUndoIntent("undo please")).toBe(true);
    expect(isUndoIntent("go back one step")).toBe(true);
  });

  it("returns false for modification requests", () => {
    expect(isUndoIntent("undo the rotation")).toBe(false);
    expect(isUndoIntent("revert the color change")).toBe(false);
  });

  it("returns false for long messages", () => {
    expect(
      isUndoIntent("can you undo the last change and also add a circle")
    ).toBe(false);
  });

  it("returns false for empty/whitespace", () => {
    expect(isUndoIntent("")).toBe(false);
    expect(isUndoIntent("   ")).toBe(false);
  });
});

describe("compactHistory", () => {
  function makeMessage(
    overrides: Partial<MessageRow> & { role: MessageRow["role"] }
  ): MessageRow {
    return {
      id: Math.random().toString(36),
      animation_id: "anim-1",
      content: "hello",
      lottie_json: null,
      image_url: null,
      created_at: new Date().toISOString(),
      ...overrides,
    };
  }

  it("caps at HISTORY_CAP (20) messages", () => {
    const messages: MessageRow[] = Array.from({ length: 25 }, (_, i) =>
      makeMessage({ role: i % 2 === 0 ? "user" : "assistant" })
    );
    const result = compactHistory(messages);
    expect(result).toHaveLength(HISTORY_CAP);
  });

  it("strips JSON code blocks from older assistant messages but keeps last", () => {
    const messages: MessageRow[] = [
      makeMessage({
        role: "assistant",
        content: 'Here is the animation:\n```json\n{"v":"5.0"}\n```',
      }),
      makeMessage({ role: "user", content: "change color" }),
      makeMessage({
        role: "assistant",
        content: 'Updated:\n```json\n{"v":"5.1"}\n```',
      }),
    ];

    const result = compactHistory(messages);
    // First assistant should have code block stripped
    expect(result[0].content).not.toContain("```json");
    expect(result[0].content).toContain("[animation updated]");
    // Last assistant should keep code block intact
    expect(result[2].content).toContain("```json");
  });

  it("strips image data URLs from older user messages but keeps last", () => {
    const messages: MessageRow[] = [
      makeMessage({
        role: "user",
        content: "make it like this",
        image_url: "data:image/png;base64,abc123",
      }),
      makeMessage({ role: "assistant", content: "done" }),
      makeMessage({
        role: "user",
        content: "now like this",
        image_url: "data:image/png;base64,def456",
      }),
    ];

    const result = compactHistory(messages);
    // First user message should have image stripped
    expect(result[0].image_url).toBeNull();
    expect(result[0].content).toContain("[image attached]");
    // Last user message with image should keep it
    expect(result[2].image_url).toBe("data:image/png;base64,def456");
  });

  it("does not mutate original array", () => {
    const messages: MessageRow[] = [
      makeMessage({
        role: "assistant",
        content: '```json\n{"v":"5.0"}\n```',
      }),
      makeMessage({ role: "assistant", content: "latest" }),
    ];

    const originalContent = messages[0].content;
    compactHistory(messages);
    expect(messages[0].content).toBe(originalContent);
  });
});
