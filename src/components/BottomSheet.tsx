"use client";

import React, { useRef, useCallback, useEffect, useState } from "react";
import { useFocusTrap } from "@/hooks/useFocusTrap";

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  /** Max height as CSS value, default "60vh" */
  height?: string;
}

export default function BottomSheet({
  open,
  onClose,
  title,
  children,
  height = "60vh",
}: BottomSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const focusTrapRef = useFocusTrap(open);
  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const startYRef = useRef(0);

  // Close on escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  // Prevent body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
      };
    }
  }, [open]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    startYRef.current = e.touches[0].clientY;
    setIsDragging(true);
  }, []);

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!isDragging) return;
      const deltaY = e.touches[0].clientY - startYRef.current;
      // Only allow dragging downward
      if (deltaY > 0) {
        setDragY(deltaY);
      }
    },
    [isDragging]
  );

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false);
    // Close if dragged more than 100px down
    if (dragY > 100) {
      onClose();
    }
    setDragY(0);
  }, [dragY, onClose]);

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/50 transition-opacity md:hidden"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sheet */}
      <div
        ref={(el) => {
          (sheetRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
          (focusTrapRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
        }}
        className="fixed bottom-0 left-0 right-0 z-50 bg-gray-900 rounded-t-2xl shadow-2xl md:hidden"
        style={{
          maxHeight: height,
          transform: `translateY(${dragY}px)`,
          transition: isDragging ? "none" : "transform 0.3s ease-out",
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
        }}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        {/* Drag handle */}
        <div
          className="flex justify-center pt-3 pb-2 cursor-grab active:cursor-grabbing"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div className="w-10 h-1 bg-gray-600 rounded-full" />
        </div>

        {/* Title */}
        {title && (
          <div className="flex items-center justify-between px-4 pb-2">
            <h3 className="text-sm font-semibold text-gray-200">{title}</h3>
            <button
              onClick={onClose}
              className="p-1 text-gray-400 hover:text-gray-200 min-w-[44px] min-h-[44px] flex items-center justify-center"
              aria-label="Close"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                className="w-5 h-5"
              >
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {/* Content */}
        <div className="overflow-y-auto px-4 pb-4" style={{ maxHeight: `calc(${height} - 60px)` }}>
          {children}
        </div>
      </div>
    </>
  );
}
