import { useCallback, useRef, useState } from "react";

const MAX_HISTORY = 20;

export function useAnimationHistory(initialState: object) {
  const pastRef = useRef<object[]>([]);
  const futureRef = useRef<object[]>([]);
  const lastJsonRef = useRef<string>(JSON.stringify(initialState));
  const [present, setPresent] = useState<object>(initialState);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const syncFlags = useCallback(() => {
    setCanUndo(pastRef.current.length > 0);
    setCanRedo(futureRef.current.length > 0);
  }, []);

  const pushState = useCallback((data: object) => {
    const json = JSON.stringify(data);
    if (json === lastJsonRef.current) return;
    lastJsonRef.current = json;

    setPresent((prev) => {
      pastRef.current.push(prev);
      if (pastRef.current.length > MAX_HISTORY) pastRef.current.shift();
      return data;
    });
    futureRef.current = [];
    syncFlags();
  }, [syncFlags]);

  const undo = useCallback((): object | null => {
    const past = pastRef.current;
    if (past.length === 0) return null;

    const prev = past.pop()!;
    setPresent((current) => {
      futureRef.current.unshift(current);
      return prev;
    });
    lastJsonRef.current = JSON.stringify(prev);
    syncFlags();
    return prev;
  }, [syncFlags]);

  const redo = useCallback((): object | null => {
    const future = futureRef.current;
    if (future.length === 0) return null;

    const next = future.shift()!;
    setPresent((current) => {
      pastRef.current.push(current);
      return next;
    });
    lastJsonRef.current = JSON.stringify(next);
    syncFlags();
    return next;
  }, [syncFlags]);

  return { present, pushState, undo, redo, canUndo, canRedo };
}
