"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import EditorLayout from "@/components/EditorLayout";

function NewEditorInner() {
  const searchParams = useSearchParams();
  const initialPrompt = searchParams.get("prompt") ?? undefined;

  return <EditorLayout id={null} initialName="Untitled Animation" initialData={null} initialPrompt={initialPrompt} />;
}

export default function NewEditorPage() {
  return (
    <Suspense>
      <NewEditorInner />
    </Suspense>
  );
}
