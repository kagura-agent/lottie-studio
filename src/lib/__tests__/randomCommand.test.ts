import { describe, it, expect } from "vitest";
import { parseCommand } from "../commands";

describe("parseCommand /random", () => {
  it("parses /random", () => {
    expect(parseCommand("/random")).toEqual({ type: "random" });
  });

  it("is case-insensitive", () => {
    expect(parseCommand("/RANDOM")).toEqual({ type: "random" });
    expect(parseCommand("/Random")).toEqual({ type: "random" });
  });

  it("handles leading/trailing whitespace", () => {
    expect(parseCommand("  /random  ")).toEqual({ type: "random" });
  });

  it("ignores extra arguments", () => {
    expect(parseCommand("/random something")).toEqual({ type: "random" });
  });
});
