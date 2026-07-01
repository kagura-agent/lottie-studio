"use client";

import React, { createContext, useCallback, useContext, useState } from "react";

export interface DesignTokens {
  primary?: string;
  secondary?: string;
  accent?: string;
  background?: string;
  font?: string;
}

interface DesignTokensContextValue {
  tokens: DesignTokens;
  setToken: (key: keyof DesignTokens, value: string) => void;
  clearTokens: () => void;
  hasTokens: boolean;
}

const STORAGE_KEY = "lottie-studio-design-tokens";

const DesignTokensContext = createContext<DesignTokensContextValue | null>(null);

function loadTokens(): DesignTokens {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return {};
    return parsed as DesignTokens;
  } catch {
    return {};
  }
}

function saveTokens(tokens: DesignTokens): void {
  if (typeof window === "undefined") return;
  const hasAny = Object.values(tokens).some((v) => v !== undefined && v !== "");
  if (hasAny) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tokens));
  } else {
    localStorage.removeItem(STORAGE_KEY);
  }
}

export function DesignTokensProvider({ children }: { children: React.ReactNode }) {
  const [tokens, setTokens] = useState<DesignTokens>(loadTokens);

  const setToken = useCallback((key: keyof DesignTokens, value: string) => {
    setTokens((prev) => {
      const next = { ...prev, [key]: value };
      saveTokens(next);
      return next;
    });
  }, []);

  const clearTokens = useCallback(() => {
    setTokens({});
    if (typeof window !== "undefined") {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  const hasTokens = Object.values(tokens).some((v) => v !== undefined && v !== "");

  return (
    <DesignTokensContext.Provider value={{ tokens, setToken, clearTokens, hasTokens }}>
      {children}
    </DesignTokensContext.Provider>
  );
}

export function useDesignTokens(): DesignTokensContextValue {
  const ctx = useContext(DesignTokensContext);
  if (!ctx) {
    throw new Error("useDesignTokens must be used within a DesignTokensProvider");
  }
  return ctx;
}
