import { useState, useCallback } from "react";

export type ComparisonMode = "toggle" | "split" | "slider";

interface BeforeAfterState {
  beforeData: object | null;
  afterData: object | null;
  isComparing: boolean;
  comparisonMode: ComparisonMode;
  setBeforeState: (data: object) => void;
  setAfterState: (data: object) => void;
  setComparisonMode: (mode: ComparisonMode) => void;
  accept: () => void;
  revert: () => object | null;
  clearComparison: () => void;
}

export function useBeforeAfter(): BeforeAfterState {
  const [beforeData, setBeforeData] = useState<object | null>(null);
  const [afterData, setAfterData] = useState<object | null>(null);
  const [isComparing, setIsComparing] = useState(false);
  const [comparisonMode, setComparisonMode] = useState<ComparisonMode>("split");

  const setBeforeState = useCallback((data: object) => {
    setBeforeData(data);
    setIsComparing(true);
  }, []);

  const setAfterState = useCallback((data: object) => {
    setAfterData(data);
  }, []);

  const accept = useCallback(() => {
    setBeforeData(null);
    setAfterData(null);
    setIsComparing(false);
  }, []);

  const revert = useCallback((): object | null => {
    const data = beforeData;
    setBeforeData(null);
    setAfterData(null);
    setIsComparing(false);
    return data;
  }, [beforeData]);

  const clearComparison = useCallback(() => {
    setBeforeData(null);
    setAfterData(null);
    setIsComparing(false);
  }, []);

  return {
    beforeData,
    afterData,
    isComparing,
    comparisonMode,
    setBeforeState,
    setAfterState,
    setComparisonMode,
    accept,
    revert,
    clearComparison,
  };
}
