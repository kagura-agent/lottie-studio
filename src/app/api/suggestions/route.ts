import { NextResponse } from "next/server";
import { analyzeAnimation } from "@/lib/suggestion-engine";
import { promptSuggestionCategories } from "@/data/prompt-suggestions";
import type { PromptSuggestion } from "@/data/prompt-suggestions";

interface RequestBody {
  animationJson?: unknown;
  selectedLayer?: Record<string, unknown> | null;
  messageCount?: number;
}

function getRandomStaticSuggestions(count: number): PromptSuggestion[] {
  const all = promptSuggestionCategories.flatMap((c) => c.suggestions);
  const shuffled = all.sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as RequestBody;
    const { animationJson, selectedLayer } = body;

    const suggestions = analyzeAnimation(animationJson, selectedLayer);

    if (suggestions.length > 0) {
      return NextResponse.json({ suggestions: suggestions.slice(0, 4) });
    }

    return NextResponse.json({ suggestions: getRandomStaticSuggestions(4) });
  } catch {
    return NextResponse.json({ suggestions: getRandomStaticSuggestions(4) });
  }
}
