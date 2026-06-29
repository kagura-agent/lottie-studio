import { describe, it, expect } from "vitest";
import { parseCommand } from "@/lib/commands";

describe("/import command", () => {
  it("parses a valid https URL", () => {
    const result = parseCommand("/import https://lottie.host/abc123/animation.json");
    expect(result).toEqual({
      type: "import",
      url: "https://lottie.host/abc123/animation.json",
    });
  });

  it("parses a valid http URL", () => {
    const result = parseCommand("/import http://example.com/anim.json");
    expect(result).toEqual({
      type: "import",
      url: "http://example.com/anim.json",
    });
  });

  it("parses URL with query params", () => {
    const result = parseCommand("/import https://cdn.example.com/file.json?v=2&token=abc");
    expect(result).toEqual({
      type: "import",
      url: "https://cdn.example.com/file.json?v=2&token=abc",
    });
  });

  it("returns error for missing URL", () => {
    const result = parseCommand("/import");
    expect(result).toEqual({
      type: "error",
      message: expect.stringContaining("Usage"),
    });
  });

  it("returns error for invalid URL", () => {
    const result = parseCommand("/import not-a-url");
    expect(result).toEqual({
      type: "error",
      message: expect.stringContaining("Invalid URL"),
    });
  });

  it("returns error for non-http protocol", () => {
    const result = parseCommand("/import ftp://example.com/file.json");
    expect(result).toEqual({
      type: "error",
      message: expect.stringContaining("http or https"),
    });
  });

  it("handles URL with spaces before it", () => {
    const result = parseCommand("/import   https://example.com/anim.json");
    expect(result).toEqual({
      type: "import",
      url: "https://example.com/anim.json",
    });
  });

  it("parses .lottie file URLs", () => {
    const result = parseCommand("/import https://lottie.host/abc/animation.lottie");
    expect(result).toEqual({
      type: "import",
      url: "https://lottie.host/abc/animation.lottie",
    });
  });
});
