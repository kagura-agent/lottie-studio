import { useCallback, useRef, useState } from "react";

const MAX_HISTORY = 20;

export function useAnimationHistory(initialState: object) {
  const pastRef = useRef<object[]>([]);
  const presentRef = useRef<object>(initialState);
  const futureRef = useRef<object[]>([]);
  const lastJsonRef = useRef<string>(JSON.stringify(initialState));
  const [, forceUpdate] = useState(0);

  const pushState = useCallback((data: object) => {
    const json = JSON.stringify(data);
    if (json === lastJsonRef.current) return;
    lastJsonRef.current = json;

    const past = pastRef.current;
    past.push(presentRef.current);
    if (past.length > MAX_HISTORY) past.shift();
    presentRef.current = data;
    futureRef.current = [];
    forceUpdate((n) => n + 1);
  }, []);

  const undo = useCallback((): object | null => {
    const past = pastRef.current;
    if (past.length === 0) return null;

    const prev = past.pop()!;
    futureRef.current.unshift(presentRef.current);
    presentRef.current = prev;
    lastJsonRef.current = JSON.stringify(prev);
    forceUpdate((n) => n + 1);
    return prev;
  }, []);

  const redo = useCallback((): object | null => {
    const future = futureRef.current;
    if (future.length === 0) return null;

    const next = future.shift()!;
    pastRef.current.push(presentRef.current);
    presentRef.current = next;
    lastJsonRef.current = JSON.stringify(next);
    forceUpdate((n) => n + 1);
    return next;
  }, []);

  const canUndo = pastRef.current.length > 0;
  const canRedo = futureRef.current.length > 0;

  return { present: presentRef.current, pushState, undo, redo, canUndo, canRedo };
}
