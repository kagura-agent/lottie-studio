"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useTranslations } from "next-intl";

const STORAGE_KEY = "lottie-studio-onboarding-done";

interface TourStep {
  target: string; // data-tour attribute value
  titleKey: string;
  descriptionKey: string;
}

const STEPS: TourStep[] = [
  {
    target: "chat-input",
    titleKey: "onboarding.step1Title",
    descriptionKey: "onboarding.step1Description",
  },
  {
    target: "canvas",
    titleKey: "onboarding.step2Title",
    descriptionKey: "onboarding.step2Description",
  },
  {
    target: "controls",
    titleKey: "onboarding.step3Title",
    descriptionKey: "onboarding.step3Description",
  },
  {
    target: "export",
    titleKey: "onboarding.step4Title",
    descriptionKey: "onboarding.step4Description",
  },
  {
    target: "chat-input",
    titleKey: "onboarding.step5Title",
    descriptionKey: "onboarding.step5Description",
  },
];

interface TooltipPosition {
  top: number;
  left: number;
  placement: "top" | "bottom" | "left" | "right";
}

function getTooltipPosition(
  targetRect: DOMRect,
  tooltipWidth: number,
  tooltipHeight: number
): TooltipPosition {
  const MARGIN = 12;
  const viewportW = window.innerWidth;
  const viewportH = window.innerHeight;

  // Prefer bottom placement
  const bottomSpace = viewportH - targetRect.bottom;
  const topSpace = targetRect.top;

  let top: number;
  let left: number;
  let placement: TooltipPosition["placement"];

  if (bottomSpace >= tooltipHeight + MARGIN) {
    // Place below
    top = targetRect.bottom + MARGIN;
    left = targetRect.left + targetRect.width / 2 - tooltipWidth / 2;
    placement = "bottom";
  } else if (topSpace >= tooltipHeight + MARGIN) {
    // Place above
    top = targetRect.top - tooltipHeight - MARGIN;
    left = targetRect.left + targetRect.width / 2 - tooltipWidth / 2;
    placement = "top";
  } else {
    // Place to the right or left
    const rightSpace = viewportW - targetRect.right;
    if (rightSpace >= tooltipWidth + MARGIN) {
      top = targetRect.top + targetRect.height / 2 - tooltipHeight / 2;
      left = targetRect.right + MARGIN;
      placement = "right";
    } else {
      top = targetRect.top + targetRect.height / 2 - tooltipHeight / 2;
      left = targetRect.left - tooltipWidth - MARGIN;
      placement = "left";
    }
  }

  // Clamp to viewport
  left = Math.max(MARGIN, Math.min(left, viewportW - tooltipWidth - MARGIN));
  top = Math.max(MARGIN, Math.min(top, viewportH - tooltipHeight - MARGIN));

  return { top, left, placement };
}

interface SpotlightRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface OnboardingTourProps {
  forceOpen?: boolean;
}

export default function OnboardingTour({ forceOpen }: OnboardingTourProps) {
  const t = useTranslations();
  const [active, setActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [spotlight, setSpotlight] = useState<SpotlightRect | null>(null);
  const [tooltipPos, setTooltipPos] = useState<TooltipPosition>({
    top: 0,
    left: 0,
    placement: "bottom",
  });
  const tooltipRef = useRef<HTMLDivElement>(null);

  // Check localStorage on mount
  useEffect(() => {
    if (forceOpen) {
      setActive(true);
      setCurrentStep(0);
      return;
    }
    try {
      const done = localStorage.getItem(STORAGE_KEY);
      if (!done) {
        // Small delay to let the editor render first
        const timer = setTimeout(() => setActive(true), 500);
        return () => clearTimeout(timer);
      }
    } catch {
      // localStorage unavailable
    }
  }, [forceOpen]);

  const updatePosition = useCallback(() => {
    if (!active) return;

    const step = STEPS[currentStep];
    const target = document.querySelector(`[data-tour="${step.target}"]`);
    if (!target) return;

    const rect = target.getBoundingClientRect();
    const padding = 8;

    setSpotlight({
      top: rect.top - padding,
      left: rect.left - padding,
      width: rect.width + padding * 2,
      height: rect.height + padding * 2,
    });

    // Calculate tooltip position
    const tooltipW = Math.min(320, window.innerWidth - 32);
    const tooltipH = 180; // estimated
    const pos = getTooltipPosition(rect, tooltipW, tooltipH);
    setTooltipPos(pos);
  }, [active, currentStep]);

  useEffect(() => {
    if (!active) return;
    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [active, updatePosition]);

  const completeTour = useCallback(() => {
    setActive(false);
    try {
      localStorage.setItem(STORAGE_KEY, "true");
    } catch {
      // ignore
    }
  }, []);

  const handleNext = useCallback(() => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep((s) => s + 1);
    } else {
      completeTour();
    }
  }, [currentStep, completeTour]);

  const handleBack = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep((s) => s - 1);
    }
  }, [currentStep]);

  const handleSkip = useCallback(() => {
    completeTour();
  }, [completeTour]);

  // Keyboard navigation
  useEffect(() => {
    if (!active) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleSkip();
      } else if (e.key === "ArrowRight" || e.key === "Enter") {
        handleNext();
      } else if (e.key === "ArrowLeft") {
        handleBack();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [active, handleSkip, handleNext, handleBack]);

  if (!active) return null;

  const step = STEPS[currentStep];
  const isLast = currentStep === STEPS.length - 1;
  const isFirst = currentStep === 0;

  return (
    <div className="fixed inset-0 z-[100]" data-testid="onboarding-tour">
      {/* Backdrop with spotlight cutout using CSS clip-path */}
      <svg
        className="absolute inset-0 w-full h-full"
        style={{ pointerEvents: "none" }}
      >
        <defs>
          <mask id="onboarding-spotlight-mask">
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            {spotlight && (
              <rect
                x={spotlight.left}
                y={spotlight.top}
                width={spotlight.width}
                height={spotlight.height}
                rx="8"
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          fill="rgba(0,0,0,0.6)"
          mask="url(#onboarding-spotlight-mask)"
          style={{ pointerEvents: "auto" }}
          onClick={handleSkip}
        />
      </svg>

      {/* Spotlight border highlight */}
      {spotlight && (
        <div
          className="absolute rounded-lg border-2 border-blue-400/60 transition-all duration-300 ease-in-out"
          style={{
            top: spotlight.top,
            left: spotlight.left,
            width: spotlight.width,
            height: spotlight.height,
            pointerEvents: "none",
          }}
        />
      )}

      {/* Tooltip */}
      <div
        ref={tooltipRef}
        className="absolute z-[101] bg-zinc-800 border border-zinc-600 rounded-xl shadow-2xl transition-all duration-300 ease-in-out"
        style={{
          top: tooltipPos.top,
          left: tooltipPos.left,
          width: Math.min(320, window.innerWidth - 32),
          pointerEvents: "auto",
        }}
      >
        <div className="p-4">
          {/* Step indicator */}
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-blue-400 font-medium">
              {t("onboarding.stepOf", {
                current: currentStep + 1,
                total: STEPS.length,
              })}
            </span>
            <button
              onClick={handleSkip}
              className="text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
              data-testid="onboarding-skip"
            >
              {t("onboarding.skip")}
            </button>
          </div>

          {/* Title */}
          <h3 className="text-zinc-100 text-sm font-semibold mb-1">
            {t(step.titleKey)}
          </h3>

          {/* Description */}
          <p className="text-zinc-300 text-sm leading-relaxed mb-4">
            {t(step.descriptionKey)}
          </p>

          {/* Step dots */}
          <div className="flex items-center justify-center gap-1.5 mb-3">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className={`w-1.5 h-1.5 rounded-full transition-colors ${
                  i === currentStep
                    ? "bg-blue-400"
                    : i < currentStep
                      ? "bg-blue-400/40"
                      : "bg-zinc-600"
                }`}
              />
            ))}
          </div>

          {/* Navigation buttons */}
          <div className="flex items-center gap-2">
            {!isFirst && (
              <button
                onClick={handleBack}
                className="flex-1 px-3 py-1.5 rounded-lg border border-zinc-600 text-zinc-300 text-sm font-medium hover:border-zinc-400 hover:text-zinc-100 transition-colors"
                data-testid="onboarding-back"
              >
                {t("onboarding.back")}
              </button>
            )}
            <button
              onClick={handleNext}
              className="flex-1 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-500 transition-colors"
              data-testid="onboarding-next"
            >
              {isLast ? t("onboarding.done") : t("onboarding.next")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Utility to reset onboarding state (used by "Restart Tour" button)
 */
export function resetOnboarding(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

export { STORAGE_KEY };
