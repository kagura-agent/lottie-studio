const LLM_API_URL = process.env.LLM_API_URL || "http://localhost:3201/v1";
const LLM_MODEL = process.env.LLM_MODEL || "claude-sonnet-4-20250514";

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

type ParseError = "no_json" | "invalid_json" | "invalid_lottie" | null;

interface LLMResponse {
  reply: string;
  lottieJson: object | null;
  parseError: ParseError;
  suggestions: string[] | null;
}

export async function chatCompletion(messages: ChatMessage[]): Promise<LLMResponse> {
  const url = `${LLM_API_URL}/chat/completions`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: LLM_MODEL,
      messages,
      temperature: 0.7,
      max_tokens: 16384,
    }),
    signal: AbortSignal.timeout(120_000),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`LLM API error ${response.status}: ${body}`);
  }

  const data = await response.json();
  const content: string = data.choices?.[0]?.message?.content ?? "";

  return parseResponse(content);
}

export async function chatCompletionStream(messages: ChatMessage[]): Promise<Response> {
  const url = `${LLM_API_URL}/chat/completions`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: LLM_MODEL,
      messages,
      temperature: 0.7,
      max_tokens: 16384,
      stream: true,
    }),
    signal: AbortSignal.timeout(120_000),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`LLM API error ${response.status}: ${body}`);
  }

  return response;
}

export async function chatCompletionRepairStream(
  originalMessages: ChatMessage[],
  failedResponse: string,
  errorType: ParseError
): Promise<Response> {
  const errorDescriptions: Record<string, string> = {
    invalid_json: "The JSON in your response was malformed and could not be parsed.",
    invalid_lottie: "The JSON in your response was valid JSON but not a valid Lottie animation (missing required 'v' or 'layers' fields).",
    no_json: "Your response did not include the Lottie JSON in a ```json code block, but it appears you were trying to generate one.",
  };

  const description = errorDescriptions[errorType || "invalid_json"];

  const repairMessages: ChatMessage[] = [
    ...originalMessages,
    { role: "assistant", content: failedResponse },
    {
      role: "user",
      content: `Your response had an error: ${description} Please fix the Lottie JSON and respond again with the corrected animation in a \`\`\`json code block.`,
    },
  ];

  const url = `${LLM_API_URL}/chat/completions`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: LLM_MODEL,
      messages: repairMessages,
      temperature: 0.5,
      max_tokens: 16384,
      stream: true,
    }),
    signal: AbortSignal.timeout(120_000),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`LLM API error ${response.status}: ${body}`);
  }

  return response;
}

export function parseResponse(content: string): LLMResponse {
  const jsonMatch = content.match(/```json\s*([\s\S]*?)```/);

  // Extract suggestions
  let suggestions: string[] | null = null;
  const suggestionsMatch = content.match(/^SUGGESTIONS:\s*(\[.*\])\s*$/m);
  if (suggestionsMatch) {
    try {
      const parsed = JSON.parse(suggestionsMatch[1]);
      if (Array.isArray(parsed) && parsed.every((s: unknown) => typeof s === "string")) {
        suggestions = parsed;
      }
    } catch {
      // Ignore malformed suggestions
    }
  }

  // Strip the SUGGESTIONS line from content before building reply
  const contentWithoutSuggestions = content.replace(/^SUGGESTIONS:\s*\[.*\]\s*$/m, "");

  if (!jsonMatch) {
    return { reply: contentWithoutSuggestions.trim(), lottieJson: null, parseError: "no_json", suggestions: null };
  }

  const jsonStr = jsonMatch[1].trim();
  const reply = contentWithoutSuggestions
    .replace(/```json\s*[\s\S]*?```/, "")
    .trim();

  try {
    const parsed = JSON.parse(jsonStr);
    if (!parsed.v || !parsed.layers) {
      return { reply: contentWithoutSuggestions.trim(), lottieJson: null, parseError: "invalid_lottie", suggestions: null };
    }
    return { reply: reply || "Here's the animation.", lottieJson: parsed, parseError: null, suggestions };
  } catch {
    return { reply: contentWithoutSuggestions.trim(), lottieJson: null, parseError: "invalid_json", suggestions: null };
  }
}
