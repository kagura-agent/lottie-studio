"use client";

import React, { createContext, useCallback, useContext, useState, useRef } from "react";

export type ToastType = "success" | "error" | "info";

export interface ToastMessage {
  id: string;
  message: string;
  type: ToastType;
  duration: number;
}

interface ToastContextValue {
  toasts: ToastMessage[];
  toast: (opts: { message: string; type: ToastType; duration?: number }) => void;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const MAX_TOASTS = 5;

const DEFAULT_DURATIONS: Record<ToastType, number> = {
  success: 4000,
  info: 4000,
  error: 6000,
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const counterRef = useRef(0);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (opts: { message: string; type: ToastType; duration?: number }) => {
      const id = `toast-${++counterRef.current}-${Date.now()}`;
      const duration = opts.duration ?? DEFAULT_DURATIONS[opts.type];
      const newToast: ToastMessage = { id, message: opts.message, type: opts.type, duration };

      setToasts((prev) => {
        const updated = [...prev, newToast];
        // Keep max 5, remove oldest if overflow
        if (updated.length > MAX_TOASTS) {
          return updated.slice(updated.length - MAX_TOASTS);
        }
        return updated;
      });

      // Auto-dismiss
      setTimeout(() => {
        dismiss(id);
      }, duration);
    },
    [dismiss]
  );

  return (
    <ToastContext.Provider value={{ toasts, toast, dismiss }}>
      {children}
    </ToastContext.Provider>
  );
}

export function useToast(): { toast: ToastContextValue["toast"] } {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return { toast: ctx.toast };
}

export function useToastContext(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToastContext must be used within a ToastProvider");
  }
  return ctx;
}
