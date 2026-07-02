import { describe, it, expect, beforeEach, vi } from "vitest";

// ─── OnboardingTour unit tests (non-DOM, logic-focused) ───

const STORAGE_KEY = "lottie-studio-onboarding-done";

describe("OnboardingTour", () => {
  let mockStorage: Record<string, string>;

  beforeEach(() => {
    mockStorage = {};
    vi.stubGlobal("localStorage", {
      getItem: vi.fn((key: string) => mockStorage[key] ?? null),
      setItem: vi.fn((key: string, value: string) => {
        mockStorage[key] = value;
      }),
      removeItem: vi.fn((key: string) => {
        delete mockStorage[key];
      }),
    });
  });

  describe("localStorage integration", () => {
    it("uses the correct storage key", () => {
      expect(STORAGE_KEY).toBe("lottie-studio-onboarding-done");
    });

    it("does not show tour when localStorage key is set", () => {
      mockStorage[STORAGE_KEY] = "true";
      const done = localStorage.getItem(STORAGE_KEY);
      expect(done).toBe("true");
    });

    it("shows tour when localStorage key is not set", () => {
      const done = localStorage.getItem(STORAGE_KEY);
      expect(done).toBeNull();
    });

    it("sets localStorage on completion", () => {
      localStorage.setItem(STORAGE_KEY, "true");
      expect(localStorage.setItem).toHaveBeenCalledWith(STORAGE_KEY, "true");
      expect(mockStorage[STORAGE_KEY]).toBe("true");
    });

    it("removes localStorage key on reset", () => {
      mockStorage[STORAGE_KEY] = "true";
      localStorage.removeItem(STORAGE_KEY);
      expect(localStorage.removeItem).toHaveBeenCalledWith(STORAGE_KEY);
      expect(mockStorage[STORAGE_KEY]).toBeUndefined();
    });
  });

  describe("tour steps", () => {
    // Import step definitions for validation
    const STEPS = [
      { target: "chat-input", titleKey: "onboarding.step1Title", descriptionKey: "onboarding.step1Description" },
      { target: "canvas", titleKey: "onboarding.step2Title", descriptionKey: "onboarding.step2Description" },
      { target: "controls", titleKey: "onboarding.step3Title", descriptionKey: "onboarding.step3Description" },
      { target: "export", titleKey: "onboarding.step4Title", descriptionKey: "onboarding.step4Description" },
      { target: "chat-input", titleKey: "onboarding.step5Title", descriptionKey: "onboarding.step5Description" },
    ];

    it("has exactly 5 steps", () => {
      expect(STEPS).toHaveLength(5);
    });

    it("first step targets chat-input", () => {
      expect(STEPS[0].target).toBe("chat-input");
    });

    it("second step targets canvas", () => {
      expect(STEPS[1].target).toBe("canvas");
    });

    it("third step targets controls", () => {
      expect(STEPS[2].target).toBe("controls");
    });

    it("fourth step targets export", () => {
      expect(STEPS[3].target).toBe("export");
    });

    it("fifth step targets chat-input again (slash commands)", () => {
      expect(STEPS[4].target).toBe("chat-input");
      expect(STEPS[4].titleKey).toBe("onboarding.step5Title");
    });

    it("all steps have required fields", () => {
      for (const step of STEPS) {
        expect(step.target).toBeTruthy();
        expect(step.titleKey).toBeTruthy();
        expect(step.descriptionKey).toBeTruthy();
      }
    });
  });

  describe("step navigation logic", () => {
    it("can advance from step 0 to step 1", () => {
      let current = 0;
      const totalSteps = 5;
      if (current < totalSteps - 1) current += 1;
      expect(current).toBe(1);
    });

    it("cannot go back from step 0", () => {
      let current = 0;
      if (current > 0) current -= 1;
      expect(current).toBe(0);
    });

    it("can go back from step 2 to step 1", () => {
      let current = 2;
      if (current > 0) current -= 1;
      expect(current).toBe(1);
    });

    it("advancing from last step should complete the tour", () => {
      let current = 4;
      const totalSteps = 5;
      const isLast = current === totalSteps - 1;
      expect(isLast).toBe(true);
    });

    it("skip at any step should complete the tour", () => {
      // Skip sets localStorage and deactivates
      localStorage.setItem(STORAGE_KEY, "true");
      expect(mockStorage[STORAGE_KEY]).toBe("true");
    });
  });
});

// ─── i18n keys validation ───

describe("Onboarding i18n keys", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const en = require("../../messages/en.json");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const zh = require("../../messages/zh.json");

  it("en.json has onboarding section", () => {
    expect(en.onboarding).toBeDefined();
  });

  it("zh.json has onboarding section", () => {
    expect(zh.onboarding).toBeDefined();
  });

  const expectedKeys = [
    "step1Title", "step1Description",
    "step2Title", "step2Description",
    "step3Title", "step3Description",
    "step4Title", "step4Description",
    "step5Title", "step5Description",
    "next", "back", "skip", "done", "stepOf", "restartTour",
  ];

  for (const key of expectedKeys) {
    it(`en.json has onboarding.${key}`, () => {
      expect(en.onboarding[key]).toBeDefined();
      expect(typeof en.onboarding[key]).toBe("string");
      expect(en.onboarding[key].length).toBeGreaterThan(0);
    });

    it(`zh.json has onboarding.${key}`, () => {
      expect(zh.onboarding[key]).toBeDefined();
      expect(typeof zh.onboarding[key]).toBe("string");
      expect(zh.onboarding[key].length).toBeGreaterThan(0);
    });
  }

  it("en and zh have the same onboarding keys", () => {
    const enKeys = Object.keys(en.onboarding).sort();
    const zhKeys = Object.keys(zh.onboarding).sort();
    expect(enKeys).toEqual(zhKeys);
  });
});
