/**
 * Attempts to complete partial JSON by closing unclosed brackets, braces, and strings.
 * Returns the parsed object or null if the partial can't form valid JSON.
 */
export function completePartialJson(partial: string): unknown | null {
  const trimmed = partial.trim();
  if (!trimmed) return null;

  // Must start with { or [ to be a JSON structure
  if (trimmed[0] !== "{" && trimmed[0] !== "[") return null;

  // Try parsing as-is first
  try {
    return JSON.parse(trimmed);
  } catch {
    // Continue with completion
  }

  // Build closing sequence by tracking open brackets/braces/strings
  let inString = false;
  let escaped = false;
  const stack: string[] = [];

  for (let i = 0; i < trimmed.length; i++) {
    const ch = trimmed[i];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (ch === "\\") {
      if (inString) escaped = true;
      continue;
    }

    if (ch === '"') {
      inString = !inString;
      continue;
    }

    if (inString) continue;

    if (ch === "{") stack.push("}");
    else if (ch === "[") stack.push("]");
    else if (ch === "}" || ch === "]") {
      if (stack.length === 0) return null;
      stack.pop();
    }
  }

  // Build the completion suffix
  let suffix = "";

  // If we're inside a string, close it
  if (inString) {
    suffix += '"';
  }

  // Remove any trailing comma or colon that would make JSON invalid
  let base = trimmed + suffix;
  const trailingClean = base.replace(/[,:\s]+$/, "");
  base = trailingClean;

  // Close all open brackets/braces in reverse order
  for (let i = stack.length - 1; i >= 0; i--) {
    base += stack[i];
  }

  try {
    return JSON.parse(base);
  } catch {
    // Try more aggressive cleanup: remove the last key-value pair if incomplete
    // Strip trailing partial values (unquoted text, partial numbers)
    const aggressive = trimmed.replace(/,\s*"[^"]*"?\s*:?\s*[^,}\]]*$/, "");
    let aggSuffix = "";
    let aggInString = false;
    let aggEscaped = false;
    const aggStack: string[] = [];

    for (let i = 0; i < aggressive.length; i++) {
      const ch = aggressive[i];
      if (aggEscaped) { aggEscaped = false; continue; }
      if (ch === "\\") { if (aggInString) aggEscaped = true; continue; }
      if (ch === '"') { aggInString = !aggInString; continue; }
      if (aggInString) continue;
      if (ch === "{") aggStack.push("}");
      else if (ch === "[") aggStack.push("]");
      else if (ch === "}" || ch === "]") aggStack.pop();
    }

    if (aggInString) aggSuffix += '"';
    let aggBase = (aggressive + aggSuffix).replace(/[,:\s]+$/, "");
    for (let i = aggStack.length - 1; i >= 0; i--) {
      aggBase += aggStack[i];
    }

    try {
      return JSON.parse(aggBase);
    } catch {
      return null;
    }
  }
}
