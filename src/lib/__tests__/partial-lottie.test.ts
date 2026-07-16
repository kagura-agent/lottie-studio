import { describe, it, expect } from "vitest";
import { extractPartialLottie } from "../partial-lottie";

describe("extractPartialLottie", () => {
  it("returns null for empty/invalid input", () => {
    expect(extractPartialLottie("")).toBeNull();
    expect(extractPartialLottie("not json")).toBeNull();
    expect(extractPartialLottie("[1,2,3]")).toBeNull();
  });

  it("returns null when missing required fields", () => {
    expect(extractPartialLottie('{"v": "5.7.0", "w": 512}')).toBeNull();
    expect(extractPartialLottie('{"v": "5.7.0", "w": 512, "h": 512}')).toBeNull();
  });

  it("returns partial lottie with minimum valid structure", () => {
    const input = '{"v": "5.7.0", "w": 512, "h": 512, "layers": []';
    const result = extractPartialLottie(input);
    expect(result).not.toBeNull();
    expect(result!.v).toBe("5.7.0");
    expect(result!.w).toBe(512);
    expect(result!.h).toBe(512);
    expect(result!.layers).toEqual([]);
    expect(result!.fr).toBe(30);
    expect(result!.ip).toBe(0);
    expect(result!.op).toBe(60);
  });

  it("preserves fr/ip/op when present", () => {
    const input = '{"v": "5.7.0", "w": 200, "h": 200, "fr": 24, "ip": 5, "op": 100, "layers": [{"ty": 4}]';
    const result = extractPartialLottie(input);
    expect(result).not.toBeNull();
    expect(result!.fr).toBe(24);
    expect(result!.ip).toBe(5);
    expect(result!.op).toBe(100);
    expect(result!.layers).toHaveLength(1);
  });

  it("returns null for invalid dimensions", () => {
    expect(extractPartialLottie('{"v": "5.7.0", "w": 0, "h": 512, "layers": []}')).toBeNull();
    expect(extractPartialLottie('{"v": "5.7.0", "w": 512, "h": -1, "layers": []}')).toBeNull();
  });
});
