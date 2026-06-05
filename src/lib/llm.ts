const LLM_API_URL = process.env.LLM_API_URL || "http://localhost:3201/v1";
const LLM_MODEL = process.env.LLM_MODEL || "claude-sonnet-4-20250514";

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface LLMResponse {
  reply: string;
  lottieJson: object | null;
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

function parseResponse(content: string): LLMResponse {
  const jsonMatch = content.match(/```json\s*([\s\S]*?)```/);

  if (!jsonMatch) {
    return { reply: content.trim(), lottieJson: null };
  }

  const jsonStr = jsonMatch[1].trim();
  const reply = content
    .replace(/```json\s*[\s\S]*?```/, "")
    .trim();

  try {
    const parsed = JSON.parse(jsonStr);
    if (!parsed.v || !parsed.layers) {
      return { reply: content.trim(), lottieJson: null };
    }
    return { reply: reply || "Here's the animation.", lottieJson: parsed };
  } catch {
    return { reply: content.trim(), lottieJson: null };
  }
}
