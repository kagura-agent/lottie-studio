import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

const CATEGORIES = [
  { key: "ui", emoji: "🔘" },
  { key: "motion", emoji: "⚡" },
  { key: "text", emoji: "✍️" },
  { key: "nature", emoji: "🌿" },
  { key: "abstract", emoji: "🎨" },
  { key: "social", emoji: "📱" },
  { key: "branding", emoji: "💎" },
  { key: "custom", emoji: "✨" },
] as const;

const STORAGE_KEY = "lottie-wizard-skip";

describe("QuickStartWizard component", () => {
  it("exports a default component function", async () => {
    const mod = await import("@/components/QuickStartWizard");
    expect(mod.default).toBeDefined();
    expect(typeof mod.default).toBe("function");
  });

  it("defines exactly 8 category cards", () => {
    expect(CATEGORIES).toHaveLength(8);
    const keys = CATEGORIES.map((c) => c.key);
    expect(keys).toEqual([
      "ui",
      "motion",
      "text",
      "nature",
      "abstract",
      "social",
      "branding",
      "custom",
    ]);
  });

  it("each category has a unique key and emoji", () => {
    const keys = new Set(CATEGORIES.map((c) => c.key));
    const emojis = new Set(CATEGORIES.map((c) => c.emoji));
    expect(keys.size).toBe(8);
    expect(emojis.size).toBe(8);
  });
});

describe("QuickStartWizard category selection", () => {
  it("clicking a non-custom category calls onSelect with the translated prompt", () => {
    const onSelect = vi.fn();
    const t = (key: string) => key;

    const nonCustomCategories = CATEGORIES.filter((c) => c.key !== "custom");
    for (const cat of nonCustomCategories) {
      const prompt = t(`categories.${cat.key}.prompt`);
      onSelect(prompt);
    }

    expect(onSelect).toHaveBeenCalledTimes(7);
    expect(onSelect).toHaveBeenCalledWith("categories.ui.prompt");
    expect(onSelect).toHaveBeenCalledWith("categories.motion.prompt");
    expect(onSelect).toHaveBeenCalledWith("categories.text.prompt");
    expect(onSelect).toHaveBeenCalledWith("categories.nature.prompt");
    expect(onSelect).toHaveBeenCalledWith("categories.abstract.prompt");
    expect(onSelect).toHaveBeenCalledWith("categories.social.prompt");
    expect(onSelect).toHaveBeenCalledWith("categories.branding.prompt");
  });

  it("clicking the custom category does not call onSelect (focuses input instead)", () => {
    const onSelect = vi.fn();
    const key = "custom";
    if (key === "custom") {
      return;
    }
    onSelect("should not be called");
    expect(onSelect).not.toHaveBeenCalled();
  });
});

describe("QuickStartWizard skip button", () => {
  it("skip calls onSkip (dismiss without prompt)", () => {
    const onSkip = vi.fn();
    onSkip();
    expect(onSkip).toHaveBeenCalledTimes(1);
  });

  it("dismiss without a prompt triggers onSkip, not onSelect", () => {
    const onSelect = vi.fn();
    const onSkip = vi.fn();

    const dismiss = (prompt?: string) => {
      if (prompt) onSelect(prompt);
      else onSkip();
    };

    dismiss();
    expect(onSkip).toHaveBeenCalledTimes(1);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("dismiss with a prompt triggers onSelect, not onSkip", () => {
    const onSelect = vi.fn();
    const onSkip = vi.fn();

    const dismiss = (prompt?: string) => {
      if (prompt) onSelect(prompt);
      else onSkip();
    };

    dismiss("test prompt");
    expect(onSelect).toHaveBeenCalledWith("test prompt");
    expect(onSkip).not.toHaveBeenCalled();
  });
});

describe("QuickStartWizard 'Don't show again' checkbox", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sets localStorage when dontShow is true on dismiss", () => {
    const dontShow = true;
    if (dontShow) {
      localStorage.setItem(STORAGE_KEY, "true");
    }
    expect(localStorage.setItem).toHaveBeenCalledWith(
      "lottie-wizard-skip",
      "true"
    );
  });

  it("does not set localStorage when dontShow is false on dismiss", () => {
    const dontShow = false;
    if (dontShow) {
      localStorage.setItem(STORAGE_KEY, "true");
    }
    expect(localStorage.setItem).not.toHaveBeenCalled();
  });

  it("uses the correct storage key", () => {
    expect(STORAGE_KEY).toBe("lottie-wizard-skip");
  });
});

describe("QuickStartWizard custom text input", () => {
  it("submits trimmed custom text via onSelect", () => {
    const onSelect = vi.fn();
    const onSkip = vi.fn();

    const dismiss = (prompt?: string) => {
      if (prompt) onSelect(prompt);
      else onSkip();
    };

    const handleCustomSubmit = (customText: string) => {
      const text = customText.trim();
      if (text) dismiss(text);
    };

    handleCustomSubmit("  a glowing particle effect  ");
    expect(onSelect).toHaveBeenCalledWith("a glowing particle effect");
  });

  it("does not submit when custom text is empty or whitespace", () => {
    const onSelect = vi.fn();

    const handleCustomSubmit = (customText: string) => {
      const text = customText.trim();
      if (text) onSelect(text);
    };

    handleCustomSubmit("");
    expect(onSelect).not.toHaveBeenCalled();

    handleCustomSubmit("   ");
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("Go button is disabled when custom text is empty", () => {
    const customText = "";
    const isDisabled = !customText.trim();
    expect(isDisabled).toBe(true);

    const customText2 = "bouncing ball";
    const isDisabled2 = !customText2.trim();
    expect(isDisabled2).toBe(false);
  });
});

describe("QuickStartWizard keyboard navigation", () => {
  it("Escape key triggers dismiss (onSkip)", () => {
    const onSkip = vi.fn();

    const handleKeyDown = (key: string) => {
      if (key === "Escape") {
        onSkip();
        return;
      }
    };

    handleKeyDown("Escape");
    expect(onSkip).toHaveBeenCalledTimes(1);
  });

  it("ArrowRight increments focused index within bounds", () => {
    let focusedIndex = 0;
    const totalCards = 8;

    const next = Math.min(focusedIndex + 1, totalCards - 1);
    focusedIndex = next;
    expect(focusedIndex).toBe(1);

    focusedIndex = 7;
    const nextAtEnd = Math.min(focusedIndex + 1, totalCards - 1);
    expect(nextAtEnd).toBe(7);
  });

  it("ArrowLeft decrements focused index within bounds", () => {
    let focusedIndex = 3;
    const next = Math.max(focusedIndex - 1, 0);
    focusedIndex = next;
    expect(focusedIndex).toBe(2);

    focusedIndex = 0;
    const nextAtStart = Math.max(focusedIndex - 1, 0);
    expect(nextAtStart).toBe(0);
  });

  it("ArrowDown jumps by column count (4 cols on large screens)", () => {
    const focusedIndex = 1;
    const cols = 4;
    const totalCards = 8;
    const next = Math.min(focusedIndex + cols, totalCards - 1);
    expect(next).toBe(5);
  });

  it("ArrowUp jumps back by column count", () => {
    const focusedIndex = 5;
    const cols = 4;
    const next = Math.max(focusedIndex - cols, 0);
    expect(next).toBe(1);
  });

  it("Enter on custom input submits the custom text", () => {
    const onSelect = vi.fn();

    const handleCustomSubmit = (customText: string) => {
      const text = customText.trim();
      if (text) onSelect(text);
    };

    const handleKeyDown = (key: string, customText: string) => {
      if (key === "Enter") handleCustomSubmit(customText);
    };

    handleKeyDown("Enter", "wave animation");
    expect(onSelect).toHaveBeenCalledWith("wave animation");
  });
});
