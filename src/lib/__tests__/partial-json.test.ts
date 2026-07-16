import { describe, it, expect } from "vitest";
import { completePartialJson } from "../partial-json";

describe("completePartialJson", () => {
  it("returns null for empty input", () => {
    expect(completePartialJson("")).toBeNull();
    expect(completePartialJson("   ")).toBeNull();
  });

  it("returns null for non-object/array input", () => {
    expect(completePartialJson("hello")).toBeNull();
    expect(completePartialJson("123")).toBeNull();
  });

  it("parses complete JSON as-is", () => {
    expect(completePartialJson('{"a": 1}')).toEqual({ a: 1 });
    expect(completePartialJson("[1, 2, 3]")).toEqual([1, 2, 3]);
  });

  it("completes an unclosed object", () => {
    expect(completePartialJson('{"a": 1')).toEqual({ a: 1 });
  });

  it("completes an unclosed array", () => {
    expect(completePartialJson("[1, 2, 3")).toEqual([1, 2, 3]);
  });

  it("completes nested structures", () => {
    const result = completePartialJson('{"a": [1, 2, {"b": 3');
    expect(result).toEqual({ a: [1, 2, { b: 3 }] });
  });

  it("completes an unclosed string", () => {
    const result = completePartialJson('{"name": "hel');
    expect(result).toEqual({ name: "hel" });
  });

  it("handles trailing comma", () => {
    const result = completePartialJson('{"a": 1,');
    expect(result).toEqual({ a: 1 });
  });

  it("handles partial Lottie-like structure", () => {
    const partial = '{"v": "5.7.0", "w": 512, "h": 512, "fr": 30, "ip": 0, "op": 60, "layers": [{"ty": 4';
    const result = completePartialJson(partial) as Record<string, unknown>;
    expect(result).not.toBeNull();
    expect(result.v).toBe("5.7.0");
    expect(result.w).toBe(512);
    expect(Array.isArray(result.layers)).toBe(true);
  });

  it("returns null for completely invalid partial", () => {
    expect(completePartialJson("{{{{{")).toBeNull();
  });
});
