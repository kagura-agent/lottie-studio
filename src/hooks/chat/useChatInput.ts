"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import type { CommandDef } from "@/components/CommandAutocomplete";
import { parseLottieFile } from "@/lib/importLottie";
import { apiFetch } from "@/lib/apiFetch";
import { SUPPORTED_TYPES, MAX_IMAGE_SIZE, MAX_ANIMATION_FILE_SIZE, ANIMATION_EXTENSIONS, LOTTIE_REQUIRED_FIELDS } from "@/lib/chat-types";
import type { Message } from "@/lib/chat-types";

interface UseChatInputOptions {
  input: string;
  setInput: React.Dispatch<React.SetStateAction<string>>;
  setPendingImage: React.Dispatch<React.SetStateAction<string | null>>;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  setCurrentAnimationId: React.Dispatch<React.SetStateAction<string | undefined>>;
  onAnimationCreated?: (id: string, data?: object) => void;
  handleSend: (promptOverride?: string) => Promise<void>;
  insertText: string | undefined;
  t: (key: string, values?: Record<string, string>) => string;
}

export function useChatInput(options: UseChatInputOptions) {
  const {
    input, setInput, setPendingImage,
    setError, setMessages, setCurrentAnimationId, onAnimationCreated,
    handleSend, insertText, t,
  } = options;

  const [isDragOver, setIsDragOver] = useState(false);
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [autocompleteQuery, setAutocompleteQuery] = useState("");
  const [prevInput, setPrevInput] = useState(input);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const inputAreaRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [prevInsertText, setPrevInsertText] = useState<string | undefined>(insertText);

  // Derived state: autocomplete
  if (input !== prevInput) {
    setPrevInput(input);
    const trimmed = input.trimStart();
    if (trimmed.startsWith("/") && !trimmed.includes(" ")) {
      setShowAutocomplete(true);
      setAutocompleteQuery(trimmed);
    } else {
      setShowAutocomplete(false);
      setAutocompleteQuery("");
    }
  }

  // Append text from layer panel selection
  if (insertText && insertText !== prevInsertText) {
    setPrevInsertText(insertText);
    setInput((prev) => prev + insertText);
  }

  // Keep chat input visible when mobile keyboard opens
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const onResize = () => {
      inputAreaRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
    };
    vv.addEventListener("resize", onResize);
    return () => vv.removeEventListener("resize", onResize);
  }, []);

  // Auto-resize textarea
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
  }, [input]);

  // Focus input when insertText changes
  useEffect(() => {
    if (!insertText) return;
    inputRef.current?.focus();
  }, [insertText]);

  const handleAutocompleteSelect = useCallback((cmd: CommandDef) => {
    if (cmd.hasParams) {
      setInput(cmd.command + " ");
    } else {
      setInput(cmd.command);
    }
    setShowAutocomplete(false);
    inputRef.current?.focus();
  }, [setInput]);

  const handleAutocompleteDismiss = useCallback(() => {
    setShowAutocomplete(false);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (showAutocomplete && ["ArrowUp", "ArrowDown", "Enter", "Tab", "Escape"].includes(e.key)) {
      return;
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const processImageFile = useCallback((file: File) => {
    if (!SUPPORTED_TYPES.includes(file.type)) {
      setError(t("unsupportedType"));
      return;
    }
    if (file.size > MAX_IMAGE_SIZE) {
      setError(t("imageTooBig"));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setPendingImage(reader.result as string);
    };
    reader.readAsDataURL(file);
  }, [t, setError, setPendingImage]);

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith("image/")) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) processImageFile(file);
        return;
      }
    }
  }, [processImageFile]);

  const processAnimationFile = useCallback(async (file: File) => {
    const ext = file.name.toLowerCase().replace(/^.*\./, ".");

    if (file.size > MAX_ANIMATION_FILE_SIZE) {
      setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: "assistant", content: t("fileTooLarge") }]);
      return;
    }

    const isSvg = ext === ".svg";
    const isJson = ext === ".json";
    const isDotLottie = ext === ".lottie";

    if (!isJson && !isSvg && !isDotLottie) {
      setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: "assistant", content: t("invalidFileType") }]);
      return;
    }

    try {
      if (isSvg) {
        const formData = new FormData();
        formData.append("file", file);
        const res = await apiFetch("/api/import-svg", { method: "POST", body: formData });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: "assistant", content: t("importFailed", { error: errData.error || "SVG conversion failed" }) }]);
          return;
        }
        const result = await res.json();
        setCurrentAnimationId(result.id);
        onAnimationCreated?.(result.id, result.data);
        setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: "assistant", content: result.message || t("importSuccess") }]);
        return;
      }

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
          setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: "assistant", content: t("invalidJsonParse") }]);
          return;
        }
        if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
          setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: "assistant", content: t("invalidLottieJson") }]);
          return;
        }
        const obj = parsed as Record<string, unknown>;
        for (const field of LOTTIE_REQUIRED_FIELDS) {
          if (!(field in obj)) {
            setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: "assistant", content: t("invalidLottieJson") }]);
            return;
          }
        }
        lottieData = obj;
        name = (lottieData.nm as string) || file.name.replace(/\.json$/i, "") || "Imported Animation";
      }

      const res = await apiFetch("/api/animations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, data: lottieData }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: "assistant", content: t("importFailed", { error: errData.error || "Failed to save animation" }) }]);
        return;
      }
      const result = await res.json();
      setCurrentAnimationId(result.id);
      onAnimationCreated?.(result.id, lottieData as object);
      setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: "assistant", content: t("importSuccess") }]);
    } catch (err) {
      setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: "assistant", content: t("importFailed", { error: err instanceof Error ? err.message : "Unknown error" }) }]);
    }
  }, [t, onAnimationCreated, setMessages, setCurrentAnimationId]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const files = e.dataTransfer?.files;
    if (!files?.length) return;
    for (let i = 0; i < files.length; i++) {
      const ext = files[i].name.toLowerCase().replace(/^.*\./, ".");
      if (ANIMATION_EXTENSIONS.includes(ext)) {
        processAnimationFile(files[i]);
        return;
      }
    }
    for (let i = 0; i < files.length; i++) {
      if (files[i].type.startsWith("image/")) {
        processImageFile(files[i]);
        return;
      }
    }
  }, [processImageFile, processAnimationFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const ext = file.name.toLowerCase().replace(/^.*\./, ".");
      if (ANIMATION_EXTENSIONS.includes(ext)) {
        processAnimationFile(file);
      } else {
        processImageFile(file);
      }
    }
    e.target.value = "";
  }, [processAnimationFile, processImageFile]);

  return {
    isDragOver,
    showAutocomplete, autocompleteQuery,
    handleAutocompleteSelect, handleAutocompleteDismiss,
    handleKeyDown, handlePaste,
    handleDrop, handleDragOver, handleDragLeave,
    handleFileInputChange,
    inputRef, inputAreaRef, fileInputRef,
    processImageFile, processAnimationFile,
  };
}
