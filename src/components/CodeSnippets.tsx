"use client";

import { useState, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { useToast } from "@/contexts/ToastContext";
import { convertLottieToCss, buildCssPreviewSrcdoc, type CssExportResult } from "@/lib/lottie-to-css";

interface CodeSnippetsProps {
  animationId: string;
  animationData?: object;
  open: boolean;
  onClose: () => void;
}

type Tab = "html" | "react" | "vue" | "reactNative" | "dotLottie" | "css";

export default function CodeSnippets({
  animationId,
  animationData,
  open,
  onClose,
}: CodeSnippetsProps) {
  const t = useTranslations();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<Tab>("html");
  const [prevOpen, setPrevOpen] = useState(open);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  // Reset state when dialog opens
  if (open && !prevOpen) {
    setActiveTab("html");
  }
  if (open !== prevOpen) {
    setPrevOpen(open);
  }

  if (!open) return null;

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const jsonUrl = `${origin}/api/animations/${animationId}/json`;

  const snippets: Record<Exclude<Tab, "css">, { install: string; code: string }> = {
    html: {
      install: `<!-- CDN -->\n<script src="https://cdnjs.cloudflare.com/ajax/libs/lottie-web/5.12.2/lottie.min.js"></script>`,
      code: `<div id="lottie-container" style="width: 400px; height: 400px;"></div>

<script>
  lottie.loadAnimation({
    container: document.getElementById('lottie-container'),
    renderer: 'svg',
    loop: true,
    autoplay: true,
    path: '${jsonUrl}'
  });
</script>`,
    },
    react: {
      install: `npm install lottie-react`,
      code: `import Lottie from 'lottie-react';
import { useEffect, useState } from 'react';

export default function Animation() {
  const [data, setData] = useState(null);

  useEffect(() => {
    fetch('${jsonUrl}')
      .then(res => res.json())
      .then(setData);
  }, []);

  if (!data) return null;

  return <Lottie animationData={data} loop autoplay />;
}`,
    },
    vue: {
      install: `npm install vue3-lottie`,
      code: `<template>
  <Vue3Lottie :animation-link="animationUrl" :loop="true" :autoplay="true" />
</template>

<script setup>
import { Vue3Lottie } from 'vue3-lottie';

const animationUrl = '${jsonUrl}';
</script>`,
    },
    reactNative: {
      install: `npm install lottie-react-native`,
      code: `import LottieView from 'lottie-react-native';

export default function Animation() {
  return (
    <LottieView
      source={{ uri: '${jsonUrl}' }}
      autoPlay
      loop
      style={{ width: 400, height: 400 }}
    />
  );
}`,
    },
    dotLottie: {
      install: `npm install @dotlottie/react-player`,
      code: `import { DotLottieReact } from '@dotlottie/react-player';

export default function Animation() {
  return (
    <DotLottieReact
      src="${jsonUrl}"
      loop
      autoplay
      style={{ width: 400, height: 400 }}
    />
  );
}`,
    },
  };

  const tabLabels: Record<Tab, string> = {
    html: t("codeSnippets.tabHtml"),
    react: t("codeSnippets.tabReact"),
    vue: t("codeSnippets.tabVue"),
    reactNative: t("codeSnippets.tabReactNative"),
    dotLottie: t("codeSnippets.tabDotLottie"),
    css: t("codeSnippets.tabs.css"),
  };

  const handleCopy = () => {
    if (activeTab === "css") {
      if (!animationData) return;
      const cssResult = convertLottieToCss(animationData);
      if (!cssResult.success) return;
      const fullText = `${cssResult.html}\n\n${cssResult.css}`;
      navigator.clipboard.writeText(fullText);
      toast({ message: t("codeSnippets.copied"), type: "success" });
      return;
    }
    const snippet = snippets[activeTab];
    const fullText = `${snippet.install}\n\n${snippet.code}`;
    navigator.clipboard.writeText(fullText);
    toast({ message: t("codeSnippets.copied"), type: "success" });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={onClose}
    >
      <div
        className="bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl w-[90vw] max-w-2xl mx-4 max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
          <h2 className="text-base font-semibold text-zinc-100">
            {t("codeSnippets.title")}
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <path d="M4 4l8 8M12 4l-8 8" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-zinc-800 overflow-x-auto">
          {(["html", "react", "vue", "reactNative", "dotLottie", "css"] as Tab[]).map(
            (tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2.5 text-sm font-medium transition-colors whitespace-nowrap ${
                  activeTab === tab
                    ? "text-zinc-100 border-b-2 border-zinc-100"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                {tabLabels[tab]}
              </button>
            )
          )}
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto flex-1">
          {activeTab === "css" ? (
            <CssTabContent animationData={animationData} t={t} handleCopy={handleCopy} />
          ) : (
          <>
          {/* Install command */}
          <div className="mb-4">
            <div className="text-xs font-medium text-zinc-400 mb-1.5 uppercase tracking-wide">
              {t("codeSnippets.install")}
            </div>
            <pre className="bg-zinc-800 rounded-lg p-3 text-sm font-mono overflow-x-auto">
              <code>
                <HighlightedCode
                  code={snippets[activeTab].install}
                  type="install"
                />
              </code>
            </pre>
          </div>

          {/* Code snippet */}
          <div>
            <div className="text-xs font-medium text-zinc-400 mb-1.5 uppercase tracking-wide">
              {t("codeSnippets.usage")}
            </div>
            <div className="relative">
              <pre className="bg-zinc-800 rounded-lg p-4 text-sm font-mono overflow-x-auto">
                <code>
                  <HighlightedCode
                    code={snippets[activeTab].code}
                    type="code"
                  />
                </code>
              </pre>
              <button
                onClick={handleCopy}
                className="absolute top-2 right-2 px-3 py-1.5 rounded-md text-xs font-medium transition-colors bg-zinc-700 text-zinc-300 hover:bg-zinc-600 hover:text-zinc-100"
              >
                {t("common.copy")}
              </button>
            </div>
          </div>
          </>
          )}
        </div>
      </div>
    </div>
  );
}

function CssTabContent({
  animationData,
  t,
  handleCopy,
}: {
  animationData?: object;
  t: ReturnType<typeof useTranslations>;
  handleCopy: () => void;
}) {
  const [showPreview, setShowPreview] = useState(false);
  const lottieContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showPreview || !animationData || !lottieContainerRef.current) return;

    let anim: import("lottie-web").AnimationItem | null = null;
    const container = lottieContainerRef.current;
    import("lottie-web").then(({ default: lottie }) => {
      if (!container) return;
      anim = lottie.loadAnimation({
        container,
        renderer: "svg",
        loop: true,
        autoplay: true,
        animationData: animationData,
      });
    });

    return () => {
      anim?.destroy();
    };
  }, [showPreview, animationData]);

  if (!animationData) {
    return <div className="text-zinc-400 text-sm">{t("common.loading")}</div>;
  }

  const result: CssExportResult = convertLottieToCss(animationData);

  if (!result.success) {
    return (
      <div className="rounded-lg border border-amber-700/50 bg-amber-950/30 p-4">
        <div className="text-amber-300 text-sm font-medium mb-2">
          {t("codeSnippets.cssNotSupported")}
        </div>
        <ul className="list-disc list-inside text-sm text-amber-200/80 space-y-1">
          {result.reasons.map((reason, i) => (
            <li key={i}>{reason}</li>
          ))}
        </ul>
      </div>
    );
  }

  const animWidth = (animationData as { w?: number }).w || 400;
  const animHeight = (animationData as { h?: number }).h || 400;
  const srcdoc = buildCssPreviewSrcdoc(result.html, result.css, animWidth, animHeight);

  return (
    <>
      {/* Preview toggle */}
      <div className="mb-4 flex items-center gap-2">
        <button
          onClick={() => setShowPreview(!showPreview)}
          className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
            showPreview
              ? "bg-zinc-100 text-zinc-900"
              : "bg-zinc-700 text-zinc-300 hover:bg-zinc-600 hover:text-zinc-100"
          }`}
        >
          {showPreview
            ? t("codeSnippets.cssHidePreview")
            : t("codeSnippets.cssShowPreview")}
        </button>
      </div>

      {/* Live preview */}
      {showPreview && (
        <div className="mb-4 flex flex-col sm:flex-row gap-4 rounded-lg border border-zinc-700 bg-zinc-800/50 p-4">
          {/* Original Lottie */}
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium text-zinc-400 mb-2 uppercase tracking-wide">
              {t("codeSnippets.cssOriginal")}
            </div>
            <div
              ref={lottieContainerRef}
              className="w-full rounded border border-zinc-700 bg-zinc-900"
              style={{ aspectRatio: `${animWidth} / ${animHeight}` }}
            />
          </div>

          {/* CSS Preview */}
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium text-zinc-400 mb-2 uppercase tracking-wide">
              {t("codeSnippets.cssCssPreview")}
            </div>
            <iframe
              sandbox=""
              srcDoc={srcdoc}
              className="w-full rounded border border-zinc-700"
              style={{ aspectRatio: `${animWidth} / ${animHeight}` }}
              title="CSS Animation Preview"
            />
          </div>
        </div>
      )}

      {/* Note */}
      <div className="mb-4 text-xs text-zinc-400">
        {t("codeSnippets.cssNote")}
      </div>

      {/* HTML Structure */}
      <div className="mb-4">
        <div className="text-xs font-medium text-zinc-400 mb-1.5 uppercase tracking-wide">
          {t("codeSnippets.cssHtml")}
        </div>
        <pre className="bg-zinc-800 rounded-lg p-3 text-sm font-mono overflow-x-auto">
          <code>
            <HighlightedCode code={result.html} type="code" />
          </code>
        </pre>
      </div>

      {/* CSS Animation */}
      <div>
        <div className="text-xs font-medium text-zinc-400 mb-1.5 uppercase tracking-wide">
          {t("codeSnippets.cssCss")}
        </div>
        <div className="relative">
          <pre className="bg-zinc-800 rounded-lg p-4 text-sm font-mono overflow-x-auto">
            <code>
              <HighlightedCode code={result.css} type="code" />
            </code>
          </pre>
          <button
            onClick={handleCopy}
            className="absolute top-2 right-2 px-3 py-1.5 rounded-md text-xs font-medium transition-colors bg-zinc-700 text-zinc-300 hover:bg-zinc-600 hover:text-zinc-100"
          >
            {t("common.copy")}
          </button>
        </div>
      </div>
    </>
  );
}

function HighlightedCode({
  code,
  type,
}: {
  code: string;
  type: "install" | "code";
}) {
  if (type === "install") {
    return <span className="text-zinc-300">{code}</span>;
  }

  // Simple syntax-ish highlighting with tailwind classes
  const lines = code.split("\n");
  return (
    <>
      {lines.map((line, i) => (
        <span key={i}>
          {highlightLine(line)}
          {i < lines.length - 1 && "\n"}
        </span>
      ))}
    </>
  );
}

function highlightLine(line: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  let remaining = line;
  let key = 0;

  // Comments (// or <!-- or #)
  if (/^\s*(\/\/|<!--|#)/.test(remaining)) {
    parts.push(
      <span key={key++} className="text-zinc-500">
        {remaining}
      </span>
    );
    return parts;
  }

  // Process tokens
  while (remaining.length > 0) {
    // Keywords
    const kwMatch = remaining.match(
      /^(import|from|export|default|function|const|return|if|let|useEffect|useState|null)\b/
    );
    if (kwMatch) {
      parts.push(
        <span key={key++} className="text-sky-400">
          {kwMatch[0]}
        </span>
      );
      remaining = remaining.slice(kwMatch[0].length);
      continue;
    }

    // HTML/JSX tags
    const tagMatch = remaining.match(/^(<\/?[a-zA-Z][a-zA-Z0-9.-]*)/);
    if (tagMatch) {
      parts.push(
        <span key={key++} className="text-red-400">
          {tagMatch[0]}
        </span>
      );
      remaining = remaining.slice(tagMatch[0].length);
      continue;
    }

    // Closing >
    const closeTag = remaining.match(/^(\s*\/?>)/);
    if (closeTag) {
      parts.push(
        <span key={key++} className="text-red-400">
          {closeTag[0]}
        </span>
      );
      remaining = remaining.slice(closeTag[0].length);
      continue;
    }

    // Strings (single or double quoted)
    const strMatch = remaining.match(/^('[^']*'|"[^"]*")/);
    if (strMatch) {
      parts.push(
        <span key={key++} className="text-emerald-400">
          {strMatch[0]}
        </span>
      );
      remaining = remaining.slice(strMatch[0].length);
      continue;
    }

    // Template literals / backtick strings
    const tplMatch = remaining.match(/^`[^`]*`/);
    if (tplMatch) {
      parts.push(
        <span key={key++} className="text-emerald-400">
          {tplMatch[0]}
        </span>
      );
      remaining = remaining.slice(tplMatch[0].length);
      continue;
    }

    // Attribute names (word followed by =)
    const attrMatch = remaining.match(/^([a-zA-Z-]+)(=)/);
    if (attrMatch) {
      parts.push(
        <span key={key++} className="text-amber-300">
          {attrMatch[1]}
        </span>
      );
      parts.push(
        <span key={key++} className="text-zinc-300">
          {attrMatch[2]}
        </span>
      );
      remaining = remaining.slice(attrMatch[0].length);
      continue;
    }

    // Braces and brackets
    const braceMatch = remaining.match(/^[{}[\]()]/);
    if (braceMatch) {
      parts.push(
        <span key={key++} className="text-zinc-400">
          {braceMatch[0]}
        </span>
      );
      remaining = remaining.slice(1);
      continue;
    }

    // Default: take the next character
    parts.push(
      <span key={key++} className="text-zinc-300">
        {remaining[0]}
      </span>
    );
    remaining = remaining.slice(1);
  }

  return parts;
}
