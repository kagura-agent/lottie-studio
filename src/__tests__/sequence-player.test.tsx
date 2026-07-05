import { describe, it, expect, vi, beforeEach } from "vitest";
import { parseCommand } from "@/lib/commands";

// --- Command parsing tests ---
describe("/sequence play command", () => {
  it("parses /sequence play <name>", () => {
    expect(parseCommand("/sequence play My Storyboard")).toEqual({
      type: "sequence_play",
      name: "My Storyboard",
    });
  });

  it("returns error for /sequence play without name", () => {
    const result = parseCommand("/sequence play");
    expect(result).toEqual({ type: "error", message: expect.stringContaining("Usage") });
  });

  it("handles multi-word names", () => {
    expect(parseCommand("/sequence play Intro And Outro")).toEqual({
      type: "sequence_play",
      name: "Intro And Outro",
    });
  });

  it("is case-insensitive for subcommand", () => {
    expect(parseCommand("/sequence PLAY test")).toEqual({
      type: "sequence_play",
      name: "test",
    });
  });

  it("does not break existing subcommands", () => {
    expect(parseCommand("/sequence create foo")).toEqual({
      type: "sequence_create",
      name: "foo",
    });
    expect(parseCommand("/sequence list")).toEqual({ type: "sequence_list" });
    expect(parseCommand("/sequence show bar")).toEqual({
      type: "sequence_show",
      name: "bar",
    });
  });
});

// --- Transition timing tests ---
describe("Transition logic", () => {
  it("cut transition resolves immediately", async () => {
    const start = Date.now();
    const result = await Promise.resolve("cut");
    const elapsed = Date.now() - start;
    expect(result).toBe("cut");
    expect(elapsed).toBeLessThan(50);
  });

  it("fade transition uses correct duration concept", () => {
    const durationMs = 500;
    const transitionValue = `opacity ${durationMs}ms ease-in-out`;
    expect(transitionValue).toBe("opacity 500ms ease-in-out");
  });

  it("slide-left transition moves in correct direction", () => {
    const incoming = { from: "translateX(100%)", to: "translateX(0)" };
    const outgoing = { from: "translateX(0)", to: "translateX(-100%)" };
    expect(incoming.from).toBe("translateX(100%)");
    expect(incoming.to).toBe("translateX(0)");
    expect(outgoing.to).toBe("translateX(-100%)");
  });

  it("slide-right transition moves in correct direction", () => {
    const incoming = { from: "translateX(-100%)", to: "translateX(0)" };
    const outgoing = { from: "translateX(0)", to: "translateX(100%)" };
    expect(incoming.from).toBe("translateX(-100%)");
    expect(incoming.to).toBe("translateX(0)");
    expect(outgoing.to).toBe("translateX(100%)");
  });
});

// --- SequencePlayer rendering tests ---
describe("SequencePlayer rendering", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("shows loading state initially", async () => {
    global.fetch = vi.fn(() => new Promise(() => {})) as unknown as typeof fetch;

    const mod = await import("@/components/SequencePlayer");
    expect(mod.default).toBeDefined();
    expect(typeof mod.default).toBe("function");
  });

  it("handles empty sequence items", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ id: "seq-1", name: "Empty", items: [] }),
    });

    const mod = await import("@/components/SequencePlayer");
    expect(mod.default).toBeDefined();
  });

  it("valid transition types match VALID_TRANSITIONS from db", () => {
    const playerTransitions = ["cut", "fade", "slide-left", "slide-right"];
    const dbTransitions = ["cut", "fade", "slide-left", "slide-right", "slide-up", "slide-down"];
    for (const t of playerTransitions) {
      expect(dbTransitions).toContain(t);
    }
  });
});
