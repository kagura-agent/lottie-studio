import { describe, it, expect } from "vitest";
import { extractDescription } from "@/lib/description";

describe("extractDescription", () => {
  it("extracts first descriptive sentence from a reply", () => {
    const reply =
      "I created a bouncing ball animation with smooth easing. The ball bounces three times before settling.";
    const desc = extractDescription(reply);
    expect(desc).toBe(
      "I created a bouncing ball animation with smooth easing. The ball bounces three times before settling."
    );
  });

  it("strips markdown formatting", () => {
    const reply =
      "I've created a **spinning gear** animation with _smooth rotation_.\nLet me know if you'd like changes!";
    const desc = extractDescription(reply);
    expect(desc).toBe(
      "I've created a spinning gear animation with smooth rotation."
    );
  });

  it("skips code blocks", () => {
    const reply = `Here's your animation:

\`\`\`json
{"v": "5.5.2", "fr": 30}
\`\`\`

I created a simple loading spinner that rotates continuously.`;
    const desc = extractDescription(reply);
    expect(desc).toBe(
      "I created a simple loading spinner that rotates continuously."
    );
  });

  it("truncates to 160 characters", () => {
    const reply =
      "I created an incredibly detailed and complex animation featuring a beautiful sunset scene with multiple layers of clouds, birds flying across the sky, and a gradient background that transitions from warm orange to deep purple as the sun descends below the horizon line.";
    const desc = extractDescription(reply);
    expect(desc).not.toBeNull();
    expect(desc!.length).toBeLessThanOrEqual(160);
    expect(desc!.endsWith("...")).toBe(true);
  });

  it("returns null for empty reply", () => {
    expect(extractDescription("")).toBeNull();
    expect(extractDescription("   ")).toBeNull();
  });

  it("returns null for code-only reply", () => {
    const reply = "```json\n{}\n```";
    // After stripping code blocks, nothing substantive remains
    const desc = extractDescription(reply);
    expect(desc).toBeNull();
  });

  it("skips 'here's' opener lines", () => {
    const reply = `Here's what I made:

A pulsing heart animation with a red-to-pink gradient and smooth scale transitions.`;
    const desc = extractDescription(reply);
    expect(desc).toBe(
      "A pulsing heart animation with a red-to-pink gradient and smooth scale transitions."
    );
  });

  it("handles reply with only short fragments gracefully", () => {
    const reply = "Done!\n\nEnjoy!";
    // Both lines < 10 chars, fallback to first non-empty line
    const desc = extractDescription(reply);
    expect(desc).toBe("Done!");
  });
});
