"use client";

import { useState, useCallback } from "react";
import { quickStartCategories, QuickStartCategory } from "@/data/quickstart-categories";

const STORAGE_KEY = "lottie-studio-quickstart-seen";

interface QuickStartWizardProps {
  onSelect: (prompt: string) => void;
  onSkip: () => void;
}

export default function QuickStartWizard({ onSelect, onSkip }: QuickStartWizardProps) {
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  const markSeen = useCallback(() => {
    try {
      localStorage.setItem(STORAGE_KEY, "true");
    } catch {}
  }, []);

  const handleCategoryClick = (category: QuickStartCategory) => {
    setExpandedCategory(expandedCategory === category.label ? null : category.label);
  };

  const handlePromptSelect = (prompt: string) => {
    markSeen();
    onSelect(prompt);
  };

  const handleSkip = () => {
    markSeen();
    onSkip();
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 p-4">
      <div className="w-full max-w-3xl">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-white sm:text-3xl">
            What would you like to create?
          </h1>
          <p className="mt-2 text-sm text-zinc-400">
            Pick a category to get started, or skip and describe your animation directly.
          </p>
        </div>

        <div
          className="grid grid-cols-2 gap-3 md:grid-cols-4"
          role="grid"
          aria-label="Animation categories"
        >
          {quickStartCategories.map((category) => {
            const isExpanded = expandedCategory === category.label;
            return (
              <div key={category.label} className="flex flex-col">
                <button
                  onClick={() => handleCategoryClick(category)}
                  aria-expanded={isExpanded}
                  aria-label={`${category.label} category`}
                  className={`flex flex-col items-center gap-2 rounded-xl border p-4 transition-all ${
                    isExpanded
                      ? "border-indigo-500 bg-zinc-800 shadow-lg shadow-indigo-500/10"
                      : "border-zinc-700 bg-zinc-900 hover:border-zinc-600 hover:bg-zinc-800"
                  }`}
                >
                  <span className="text-2xl">{category.emoji}</span>
                  <span className="text-sm font-medium text-white">{category.label}</span>
                </button>

                {isExpanded && (
                  <div
                    className="mt-2 flex flex-col gap-1.5"
                    role="list"
                    aria-label={`${category.label} prompts`}
                  >
                    {category.prompts.map((prompt) => (
                      <button
                        key={prompt}
                        onClick={() => handlePromptSelect(prompt)}
                        className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-left text-xs text-zinc-300 transition-colors hover:border-indigo-500 hover:bg-zinc-800 hover:text-white"
                        role="listitem"
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-8 text-center">
          <button
            onClick={handleSkip}
            className="text-sm text-zinc-500 transition-colors hover:text-zinc-300"
          >
            Skip — I know what I want
          </button>
        </div>
      </div>
    </div>
  );
}
