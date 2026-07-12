"use client";

import { promptSuggestionCategories } from "@/data/prompt-suggestions";
import type { PromptSuggestion } from "@/data/prompt-suggestions";

interface PromptSuggestionsProps {
  onSelect: (prompt: string) => void;
  hasDesignTokens: boolean;
  dynamicSuggestions?: PromptSuggestion[] | null;
}

const COLOR_PROMPTS = new Set([
  "Pulsing heart",
  "Color wave",
  "Loading spinner",
  "Confetti burst",
  "Floating hearts",
  "Fire emoji",
  "Logo reveal",
  "Particle intro",
]);

export default function PromptSuggestions({ onSelect, hasDesignTokens, dynamicSuggestions }: PromptSuggestionsProps) {
  const handleClick = (label: string, prompt: string) => {
    const finalPrompt =
      hasDesignTokens && COLOR_PROMPTS.has(label)
        ? prompt + " using my brand colors"
        : prompt;
    onSelect(finalPrompt);
  };

  return (
    <div className="flex flex-col gap-5 px-2 py-4 max-w-lg mx-auto w-full" data-testid="prompt-suggestions">
      <h2 className="text-zinc-300 text-base font-medium text-center">
        What would you like to create?
      </h2>
      {dynamicSuggestions && dynamicSuggestions.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">
            Suggested for You
          </h3>
          <div className="flex flex-wrap gap-2">
            {dynamicSuggestions.map((s) => (
              <button
                key={s.label}
                onClick={() => onSelect(s.prompt)}
                className="px-3 py-1.5 rounded-full text-xs text-zinc-300 bg-zinc-800 border border-indigo-600/40 hover:bg-indigo-600 hover:border-indigo-500 hover:text-white active:bg-indigo-700 transition-colors"
                title={s.prompt}
                aria-label={s.prompt}
              >
                <span className="mr-1">{s.emoji}</span>
                {s.label}
              </button>
            ))}
          </div>
        </div>
      )}
      {promptSuggestionCategories.map((category) => (
        <div key={category.title}>
          <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">
            {category.title}
          </h3>
          <div className="flex flex-wrap gap-2">
            {category.suggestions.map((s) => (
              <button
                key={s.label}
                onClick={() => handleClick(s.label, s.prompt)}
                className="px-3 py-1.5 rounded-full text-xs text-zinc-300 bg-zinc-800 border border-zinc-700 hover:bg-indigo-600 hover:border-indigo-500 hover:text-white active:bg-indigo-700 transition-colors"
                title={s.prompt}
                aria-label={s.prompt}
              >
                <span className="mr-1">{s.emoji}</span>
                {s.label}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
