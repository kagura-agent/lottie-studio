import { describe, it, expect } from "vitest";
import {
  compactHistory,
  isUndoIntent,
  HISTORY_CAP,
  LOTTIE_CODE_BLOCK_RE,
  type MessageRow,
} from "../chat-utils";

/** Helper to build a MessageRow with sensible defaults. */
function makeMsg(
  overrides: Partial<MessageRow> & { role: MessageRow["role"]; content: string }
): MessageRow {
  return {
    id: overrides.id ?? "msg-1",
    animation_id: overrides.animation_id ?? "anim-1",
    role: overrides.role,
    content: overrides.content,
    lottie_json: overrides.lottie_json ?? null,
    image_url: overrides.image_url ?? null,
    created_at: overrides.created_at ?? new Date().toISOString(),
  };
}

describe("LOTTIE_CODE_BLOCK_RE", () => {
  it("matches a json code block", () => {
    const text = 'Here is the animation:\n```json\n{"v":"5.7.1"}\n```\nDone.';
    expect(text.replace(LOTTIE_CODE_BLOCK_RE, "[replaced]")).toBe(
      "Here is the animation:\n[replaced]\nDone."
    );
  });
});

describe("compactHistory", () => {
  it("returns a shallow copy for small history", () => {
    const msgs: MessageRow[] = [
      makeMsg({ role: "user", content: "hello" }),
      makeMsg({ role: "assistant", content: "hi" }),
    ];
    const result = compactHistory(msgs);
    expect(result).toHaveLength(2);
    // Should be a new array (not same reference)
    expect(result).not.toBe(msgs);
    // Content preserved
    expect(result[0].content).toBe("hello");
    expect(result[1].content).toBe("hi");
  });

  it("caps history at HISTORY_CAP messages", () => {
    const msgs: MessageRow[] = [];
    for (let i = 0; i < HISTORY_CAP + 10; i++) {
      msgs.push(
        makeMsg({
          id: `msg-${i}`,
          role: i % 2 === 0 ? "user" : "assistant",
          content: `message ${i}`,
        })
      );
    }
    const result = compactHistory(msgs);
    expect(result).toHaveLength(HISTORY_CAP);
    // Should keep the last HISTORY_CAP messages
    expect(result[0].content).toBe(`message ${10}`);
    expect(result[result.length - 1].content).toBe(`message ${HISTORY_CAP + 9}`);
  });

  it("strips Lottie JSON code blocks from old assistant messages but keeps last", () => {
    const msgs: MessageRow[] = [
      makeMsg({ role: "user", content: "make a circle" }),
      makeMsg({
        role: "assistant",
        content: 'Here is a circle:\n```json\n{"v":"5.7.1","layers":[]}\n```\nEnjoy!',
      }),
      makeMsg({ role: "user", content: "make it red" }),
      makeMsg({
        role: "assistant",
        content: 'Updated:\n```json\n{"v":"5.7.1","layers":[{"color":"red"}]}\n```\nDone.',
      }),
    ];
    const result = compactHistory(msgs);

    // First assistant message (index 1) should have code block stripped
    expect(result[1].content).toBe("Here is a circle:\n[animation updated]\nEnjoy!");

    // Last assistant message (index 3) should keep code block
    expect(result[3].content).toContain("```json");
    expect(result[3].content).toContain('"color":"red"');
  });

  it("strips base64 image data URLs from old user messages but keeps most recent", () => {
    const msgs: MessageRow[] = [
      makeMsg({
        role: "user",
        content: "check this image",
        image_url: "data:image/png;base64,AAAA",
      }),
      makeMsg({ role: "assistant", content: "Nice image!" }),
      makeMsg({
        role: "user",
        content: "and this one",
        image_url: "data:image/png;base64,BBBB",
      }),
      makeMsg({ role: "assistant", content: "Also nice!" }),
    ];
    const result = compactHistory(msgs);

    // First user message (index 0) should have image_url stripped
    expect(result[0].image_url).toBeNull();
    expect(result[0].content).toBe("[image attached] check this image");

    // Second user message with image (index 2) is the last → should keep image_url
    expect(result[2].image_url).toBe("data:image/png;base64,BBBB");
    expect(result[2].content).toBe("and this one");
  });

  it("does not double-prefix [image attached]", () => {
    const msgs: MessageRow[] = [
      makeMsg({
        role: "user",
        content: "[image attached] already tagged",
        image_url: "data:image/png;base64,OLD",
      }),
      makeMsg({ role: "assistant", content: "ok" }),
      makeMsg({
        role: "user",
        content: "new image",
        image_url: "data:image/png;base64,NEW",
      }),
    ];
    const result = compactHistory(msgs);
    // Should not add a second [image attached]
    expect(result[0].content).toBe("[image attached] already tagged");
    expect(result[0].image_url).toBeNull();
  });

  it("handles empty history", () => {
    const result = compactHistory([]);
    expect(result).toEqual([]);
  });

  it("handles single message", () => {
    const msgs: MessageRow[] = [makeMsg({ role: "user", content: "hi" })];
    const result = compactHistory(msgs);
    expect(result).toHaveLength(1);
    expect(result[0].content).toBe("hi");
  });

  it("handles all user messages (no assistant)", () => {
    const msgs: MessageRow[] = [
      makeMsg({ role: "user", content: "one" }),
      makeMsg({ role: "user", content: "two" }),
      makeMsg({ role: "user", content: "three" }),
    ];
    const result = compactHistory(msgs);
    expect(result).toHaveLength(3);
    // No assistant messages, so no code block stripping needed
    result.forEach((m) => expect(m.role).toBe("user"));
  });

  it("handles all assistant messages (no user)", () => {
    const msgs: MessageRow[] = [
      makeMsg({
        role: "assistant",
        content: 'old:\n```json\n{"v":"5.7.1"}\n```',
      }),
      makeMsg({
        role: "assistant",
        content: 'latest:\n```json\n{"v":"5.7.1","layers":[]}\n```',
      }),
    ];
    const result = compactHistory(msgs);
    expect(result).toHaveLength(2);
    // First should be stripped
    expect(result[0].content).toBe("old:\n[animation updated]");
    // Last should be preserved
    expect(result[1].content).toContain("```json");
  });

  it("does not mutate original messages", () => {
    const msgs: MessageRow[] = [
      makeMsg({
        role: "assistant",
        content: 'text\n```json\n{"v":"5.7.1"}\n```',
      }),
      makeMsg({ role: "assistant", content: "last" }),
    ];
    const originalContent = msgs[0].content;
    compactHistory(msgs);
    expect(msgs[0].content).toBe(originalContent);
  });
});

describe("isUndoIntent", () => {
  it("detects exact undo keywords", () => {
    expect(isUndoIntent("undo")).toBe(true);
    expect(isUndoIntent("revert")).toBe(true);
    expect(isUndoIntent("go back")).toBe(true);
    expect(isUndoIntent("undo that")).toBe(true);
    expect(isUndoIntent("undo last change")).toBe(true);
    expect(isUndoIntent("revert to previous")).toBe(true);
  });

  it("detects Chinese undo keywords", () => {
    expect(isUndoIntent("撤销")).toBe(true);
    expect(isUndoIntent("回退")).toBe(true);
    expect(isUndoIntent("撤回")).toBe(true);
  });

  it("is case-insensitive", () => {
    expect(isUndoIntent("Undo")).toBe(true);
    expect(isUndoIntent("REVERT")).toBe(true);
    expect(isUndoIntent("Go Back")).toBe(true);
    expect(isUndoIntent("UNDO THAT")).toBe(true);
  });

  it("handles whitespace", () => {
    expect(isUndoIntent("  undo  ")).toBe(true);
    expect(isUndoIntent("\n revert \n")).toBe(true);
  });

  it("detects go back variants", () => {
    expect(isUndoIntent("go back one step")).toBe(true);
    expect(isUndoIntent("go back please")).toBe(true);
  });

  it("detects undo with generic suffixes", () => {
    expect(isUndoIntent("undo it")).toBe(true);
    expect(isUndoIntent("undo this")).toBe(true);
    expect(isUndoIntent("undo please")).toBe(true);
    expect(isUndoIntent("revert that")).toBe(true);
    expect(isUndoIntent("undo last edit")).toBe(true);
    expect(isUndoIntent("undo last step")).toBe(true);
  });

  it("rejects modification requests containing undo", () => {
    expect(isUndoIntent("undo the rotation")).toBe(false);
    expect(isUndoIntent("undo the color change and make it blue")).toBe(false);
    expect(isUndoIntent("revert the background color")).toBe(false);
  });

  it("rejects long messages", () => {
    expect(isUndoIntent("can you please undo the last thing you did")).toBe(false);
    expect(isUndoIntent("I want to undo the rotation and make it bigger")).toBe(false);
  });

  it("rejects unrelated messages", () => {
    expect(isUndoIntent("make a bouncing ball")).toBe(false);
    expect(isUndoIntent("change the color to red")).toBe(false);
    expect(isUndoIntent("")).toBe(false);
    expect(isUndoIntent("   ")).toBe(false);
  });
});
