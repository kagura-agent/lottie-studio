/**
 * Extract a short description (≤160 chars) from an LLM assistant reply.
 *
 * Heuristic: Take the first 1-2 sentences that describe what was created/modified,
 * skipping markdown formatting, code blocks, and meta-commentary.
 */
export function extractDescription(reply: string): string | null {
  if (!reply || !reply.trim()) return null;

  // Remove markdown code blocks (```...```)
  let text = reply.replace(/```[\s\S]*?```/g, "");

  // Remove inline code
  text = text.replace(/`[^`]+`/g, "");

  // Remove markdown bold/italic markers
  text = text.replace(/\*\*([^*]+)\*\*/g, "$1");
  text = text.replace(/\*([^*]+)\*/g, "$1");
  text = text.replace(/__([^_]+)__/g, "$1");
  text = text.replace(/_([^_]+)_/g, "$1");

  // Remove markdown headers
  text = text.replace(/^#{1,6}\s+/gm, "");

  // Remove markdown links but keep text
  text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");

  // Split into lines and filter out empty lines
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) return null;

  // Skip lines that look like bullet points starting with technical details
  // Take the first substantive line(s)
  let description = "";

  for (const line of lines) {
    // Skip very short lines (likely headers or fragments)
    if (line.length < 10) continue;

    // Skip lines that are just questions or prompts to the user
    if (/^(would you|do you|shall I|let me know|here's|here are)/i.test(line)) continue;

    // This looks like a good descriptive line
    if (!description) {
      description = line;
    } else {
      // Try to append the second sentence if it fits
      const combined = description + " " + line;
      if (combined.length <= 160) {
        description = combined;
      }
      break;
    }
  }

  if (!description) {
    // Fallback: just use the first non-empty line
    description = lines[0] || "";
  }

  // Truncate to 160 characters
  if (description.length > 160) {
    description = description.slice(0, 157) + "...";
  }

  return description || null;
}
