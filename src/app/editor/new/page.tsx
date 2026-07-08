"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useState, useCallback, useEffect } from "react";
import EditorLayout from "@/components/EditorLayout";
import QuickStartWizard from "@/components/QuickStartWizard";

const STORAGE_KEY = "lottie-wizard-skip";

function NewEditorInner() {
  const searchParams = useSearchParams();
  const promptParam = searchParams.get("prompt") ?? undefined;
  const skipParam = searchParams.get("skip") === "true";

  const [showWizard, setShowWizard] = useState(false);
  const [initialPrompt, setInitialPrompt] = useState(promptParam);
  const [ready, setReady] = useState(!!promptParam || skipParam);

  useEffect(() => {
    if (promptParam || skipParam) return;
    try {
      if (localStorage.getItem(STORAGE_KEY) === "true") {
        setReady(true);
        return;
      }
    } catch {}
    setShowWizard(true);
  }, [promptParam, skipParam]);

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
