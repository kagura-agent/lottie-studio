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

  it("handles escape sequences inside strings", () => {
    expect(completePartialJson('{"a": "line1\\nline2"}')).toEqual({
      a: "line1\nline2",
    });
    expect(completePartialJson('{"a": "say \\"hi\\""}')).toEqual({
      a: 'say "hi"',
    });
    expect(completePartialJson('{"a": "back\\\\slash"}')).toEqual({
      a: "back\\slash",
    });
  });

  it("handles escaped quote in unclosed string", () => {
    const result = completePartialJson('{"a": "val\\"');
    expect(result).toEqual({ a: 'val"' });
  });

  it("handles escape at end of incomplete string", () => {
    // Ends with backslash inside string - escaped=true at end, string still open
    const result = completePartialJson('{"a": "val\\');
    // The trailing backslash leaves escaped=true; inString stays true; suffix closes quote
    // But the resulting JSON has a trailing backslash before closing quote which is invalid
    expect(result).toBeNull();
  });

  it("ignores backslash outside of strings", () => {
    // Backslash outside string hits the `continue` without setting escaped
    // Result is null because the backslash makes JSON unparseable
    expect(completePartialJson('[1, \\2]')).toBeNull();
  });

  it("handles extra closing brackets returning null", () => {
    expect(completePartialJson("}")).toBeNull();
    expect(completePartialJson("]")).toBeNull();
  });

  it("returns null when stack is empty and closing bracket found", () => {
    // Starts with [ so passes initial check, but has extra ]
    expect(completePartialJson("[1]]")).toBeNull();
  });

  it("handles trailing colon cleanup", () => {
    const result = completePartialJson('{"a": 1, "b":');
    expect(result).toEqual({ a: 1 });
  });

  it("handles trailing whitespace after comma", () => {
    const result = completePartialJson('{"a": 1,   ');
    expect(result).toEqual({ a: 1 });
  });

  it("exercises aggressive cleanup with incomplete key-value", () => {
    // This should fail first parse and trigger aggressive cleanup:
    // partial key-value like ,"key": partialVal at end
    const result = completePartialJson('{"a": 1, "b": tru');
    expect(result).not.toBeNull();
    expect((result as Record<string, unknown>).a).toBe(1);
  });

  it("exercises aggressive cleanup with partial key only", () => {
    const result = completePartialJson('{"a": 1, "b');
    expect(result).not.toBeNull();
    expect((result as Record<string, unknown>).a).toBe(1);
  });

  it("deeply nested incomplete structures", () => {
    const result = completePartialJson('{"a": {"b": {"c": [1, {"d": 2');
    expect(result).toEqual({ a: { b: { c: [1, { d: 2 }] } } });
  });

  it("array with trailing comma", () => {
    expect(completePartialJson("[1, 2,")).toEqual([1, 2]);
  });

  it("aggressive cleanup produces empty array for trailing commas", () => {
    expect(completePartialJson("[,,,")).toEqual([]);
  });

  it("aggressive cleanup with string containing escape in cleaned portion", () => {
    // Tests the aggEscaped/aggInString paths in aggressive cleanup
    const result = completePartialJson('{"a": "x\\"y", "b": inval');
    expect(result).not.toBeNull();
    expect((result as Record<string, unknown>).a).toBe('x"y');
  });
});
