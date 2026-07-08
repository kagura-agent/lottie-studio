"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useState, useCallback } from "react";
import EditorLayout from "@/components/EditorLayout";
import QuickStartWizard from "@/components/QuickStartWizard";

const STORAGE_KEY = "lottie-wizard-skip";

function shouldSkipWizard(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

function NewEditorInner() {
  const searchParams = useSearchParams();
  const promptParam = searchParams.get("prompt") ?? undefined;
  const skipParam = searchParams.get("skip") === "true";

  const [showWizard, setShowWizard] = useState(
    () => !promptParam && !skipParam && !shouldSkipWizard()
  );
  const [initialPrompt, setInitialPrompt] = useState(promptParam);
  const [ready, setReady] = useState(
    () => !!promptParam || skipParam || shouldSkipWizard()
  );

  const handleSelect = useCallback((prompt: string) => {
    setInitialPrompt(prompt);
    setShowWizard(false);
    setReady(true);
  }, []);

  const handleSkip = useCallback(() => {
    setShowWizard(false);
    setReady(true);
  }, []);

  if (showWizard) {
    return <QuickStartWizard onSelect={handleSelect} onSkip={handleSkip} />;
  }

  if (!ready) return null;

  return <EditorLayout id={null} initialName="Untitled Animation" initialData={null} initialPrompt={initialPrompt} />;
}

export default function NewEditorPage() {
  return (
    <Suspense>
      <NewEditorInner />
    </Suspense>
  );
}
