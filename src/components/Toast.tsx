"use client";

import React, { useEffect, useState } from "react";
import { useToastContext, type ToastMessage, type ToastType } from "@/contexts/ToastContext";

const typeStyles: Record<ToastType, string> = {
  error: "border-l-red-500",
  success: "border-l-green-500",
  info: "border-l-blue-500",
};

const typeIcons: Record<ToastType, string> = {
  error: "✕",
  success: "✓",
  info: "ℹ",
};

const typeIconColors: Record<ToastType, string> = {
  error: "text-red-500",
  success: "text-green-500",
  info: "text-blue-500",
};

function ToastItem({ toast, onDismiss }: { toast: ToastMessage; onDismiss: () => void }) {
  const [visible, setVisible] = useState(false);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    // Trigger slide-in
    const frame = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    // Start exit animation before removal
    const exitTime = toast.duration - 300;
    if (exitTime > 0) {
      const timer = setTimeout(() => setExiting(true), exitTime);
      return () => clearTimeout(timer);
    }
  }, [toast.duration]);

  const handleDismiss = () => {
    setExiting(true);
    setTimeout(onDismiss, 300);
  };

  return (
    <div
      role="alert"
      aria-live="polite"
      className={`
        flex items-start gap-3 px-4 py-3
        bg-zinc-800 border border-zinc-700 border-l-4 ${typeStyles[toast.type]}
        rounded-lg shadow-lg max-w-sm w-full
        transition-all duration-300 ease-in-out
        ${visible && !exiting ? "translate-x-0 opacity-100" : "translate-x-full opacity-0"}
      `}
    >
      <span className={`font-bold text-sm flex-shrink-0 mt-0.5 ${typeIconColors[toast.type]}`} aria-hidden="true">
        {typeIcons[toast.type]}
      </span>
      <p className="text-sm text-zinc-100 flex-1 break-words">{toast.message}</p>
      <button
        onClick={handleDismiss}
        className="text-zinc-400 hover:text-zinc-200 flex-shrink-0 text-sm leading-none mt-0.5"
        aria-label="Dismiss notification"
      >
        ✕
      </button>
    </div>
  );
}

export function ToastContainer() {
  const { toasts, dismiss } = useToastContext();

  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none"
      aria-label="Notifications"
    >
      {toasts.map((t) => (
        <div key={t.id} className="pointer-events-auto">
          <ToastItem toast={t} onDismiss={() => dismiss(t.id)} />
        </div>
      ))}
    </div>
  );
}
