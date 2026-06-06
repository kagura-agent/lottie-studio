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

export function parseResponse(content: string): LLMResponse {
  const jsonMatch = content.match(/```json\s*([\s\S]*?)```/);

  if (!jsonMatch) {
    return { reply: content.trim(), lottieJson: null, parseError: "no_json" };
  }

  const jsonStr = jsonMatch[1].trim();
  const reply = content
    .replace(/```json\s*[\s\S]*?```/, "")
    .trim();

  try {
    const parsed = JSON.parse(jsonStr);
    if (!parsed.v || !parsed.layers) {
      return { reply: content.trim(), lottieJson: null, parseError: "invalid_lottie" };
    }
    return { reply: reply || "Here's the animation.", lottieJson: parsed, parseError: null };
  } catch {
    return { reply: content.trim(), lottieJson: null, parseError: "invalid_json" };
  }
}
