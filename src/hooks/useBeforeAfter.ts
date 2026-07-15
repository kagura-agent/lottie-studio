"use client";

import { useState, useCallback } from "react";

export type CompareMode = "toggle" | "split" | "slider";

interface BeforeAfterState {
  beforeJson: object | null;
  afterJson: object | null;
  isActive: boolean;
  mode: CompareMode;
}

export function useBeforeAfter() {
  const [state, setState] = useState<BeforeAfterState>({
    beforeJson: null,
    afterJson: null,
    isActive: false,
    mode: "toggle",
  });

  const activate = useCallback((before: object, after: object) => {
    setState((s) => ({
      ...s,
      beforeJson: before,
      afterJson: after,
      isActive: true,
    }));
  }, []);

  const deactivate = useCallback(() => {
    setState((s) => ({ ...s, isActive: false }));
  }, []);

  const setMode = useCallback((mode: CompareMode) => {
    setState((s) => ({ ...s, mode }));
  }, []);

  return {
    beforeJson: state.beforeJson,
    afterJson: state.afterJson,
    isActive: state.isActive,
    mode: state.mode,
    activate,
    deactivate,
    setMode,
  };
}
