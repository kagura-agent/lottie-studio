"use client";

import { useState, useCallback, useRef } from "react";
import { useTranslations } from 'next-intl';
import { parseLottieFile } from "@/lib/importLottie";
import { apiFetch } from "@/lib/apiFetch";

interface ImportLottieProps {
  onImported: (id: string, data: object) => void;
}

const REQUIRED_FIELDS = ["v", "fr", "ip", "op", "w", "h", "layers"] as const;

function validateLottieJson(data: unknown): { valid: true; data: Record<string, unknown> } | { valid: false; error: string } {
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    return { valid: false, error: "File does not contain a valid JSON object" };
  }
  const obj = data as Record<string, unknown>;
  for (const field of REQUIRED_FIELDS) {
    if (!(field in obj)) {
      return { valid: false, error: `Missing required field: "${field}"` };
    }
  }
  if (!Array.isArray(obj.layers)) {
    return { valid: false, error: '"layers" must be an array' };
  }
  if (typeof obj.w !== "number" || typeof obj.h !== "number") {
    return { valid: false, error: '"w" and "h" must be numbers' };
  }
  if (typeof obj.fr !== "number") {
    return { valid: false, error: '"fr" (frame rate) must be a number' };
  }
  return { valid: true, data: obj };
}

export default function ImportLottie({ onImported }: ImportLottieProps) {
  const t = useTranslations('importLottie');
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback(async (file: File) => {
    setError(null);
    setImporting(true);

    try {
      const isSvg = file.name.toLowerCase().endsWith(".svg");
      const isJson = file.name.toLowerCase().endsWith(".json");
      const isDotLottie = file.name.toLowerCase().endsWith(".lottie");

      if (!isJson && !isSvg && !isDotLottie) {
        setError(t('invalidFormat'));
        setImporting(false);
        return;
      }

      if (file.size > 5 * 1024 * 1024) {
        setError(t('tooLarge'));
        setImporting(false);
        return;
      }

      if (isSvg) {
        // SVG files: send to conversion endpoint
        const formData = new FormData();
        formData.append("file", file);

        const res = await fetch("/api/import-svg", {
          method: "POST",
          body: formData,
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          setError(errData.error || "SVG conversion failed");
          setImporting(false);
          return;
        }

        const result = await res.json();
        onImported(result.id, result.data);
        return;
      }

      // JSON and .lottie files: validate client-side and create animation
      let lottieData: Record<string, unknown>;
      let name: string;

      if (isDotLottie) {
        const parsed = await parseLottieFile(file);
        lottieData = parsed.data as Record<string, unknown>;
        name = parsed.name;
      } else {
        const text = await file.text();
        let parsed: unknown;
        try {
          parsed = JSON.parse(text);
        } catch {
          setError(t('invalidJson'));
          setImporting(false);
          return;
        }

        const validation = validateLottieJson(parsed);
        if (!validation.valid) {
          setError(validation.error);
          setImporting(false);
          return;
        }

        lottieData = validation.data;
        name = (lottieData.nm as string) || file.name.replace(/\.json$/i, "") || "Imported Animation";
      }

      // Build import description for the chat seed message
      const layers = lottieData.layers as unknown[];
      const duration = ((lottieData.op as number) - (lottieData.ip as number)) / (lottieData.fr as number);
      const importMessage = `Imported **${name}** — ${lottieData.w}×${lottieData.h}px, ${layers.length} layer${layers.length !== 1 ? "s" : ""}, ${duration.toFixed(1)}s at ${lottieData.fr}fps. What would you like to change?`;

      // Create animation via API (with seed message)
      const res = await apiFetch("/api/animations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, data: lottieData, importMessage }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        setError(errData.error || "Failed to create animation");
        setImporting(false);
        return;
      }

      const result = await res.json();
      const animationId = result.id;

      onImported(animationId, lottieData as object);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImporting(false);
    }
  }, [onImported]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    // Reset input so the same file can be re-selected
    e.target.value = "";
  }, [processFile]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  }, [processFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  }, []);

  return (
    <div
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      role="region"
      aria-label="File drop zone"
      className={`flex flex-col items-center justify-center gap-4 p-8 rounded-xl border-2 border-dashed transition-colors ${
        dragOver
          ? "border-violet-500 bg-violet-500/10"
          : "border-zinc-700 hover:border-zinc-500"
      }`}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,.svg,.lottie"
        onChange={handleFileSelect}
        aria-label="Upload Lottie animation file"
        className="hidden"
      />

      {/* Upload icon */}
      <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-400">
          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" y1="3" x2="12" y2="15" />
        </svg>
      </div>

      <div className="text-center">
        <p className="text-sm text-zinc-300 font-medium">
          {importing ? t('converting') : t('title')}
        </p>
        <p className="text-xs text-zinc-500 mt-1">
          {t('hint')}
        </p>
      </div>

      <button
        onClick={() => fileInputRef.current?.click()}
        disabled={importing}
        className="px-4 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-sm text-zinc-200 hover:bg-zinc-700 hover:border-zinc-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {t(importing ? 'converting' : 'chooseFile')}
      </button>

      {error && (
        <div role="alert" className="flex items-start gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30 max-w-sm">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-red-400 shrink-0 mt-0.5">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <p className="text-xs text-red-300">{error}</p>
        </div>
      )}
    </div>
  );
}
