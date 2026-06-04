import { useEffect, useRef, useCallback } from "react";

export function useAnimationSocket(animationId: string, onUpdated: () => void) {
  const onUpdatedRef = useRef(onUpdated);
  onUpdatedRef.current = onUpdated;

  const reconnectAttempt = useRef(0);
  const wsRef = useRef<WebSocket | null>(null);
  const unmountedRef = useRef(false);

  const connect = useCallback(() => {
    if (unmountedRef.current) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const url = `${protocol}//${window.location.host}/ws?animationId=${encodeURIComponent(animationId)}`;
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      reconnectAttempt.current = 0;
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "updated") {
          onUpdatedRef.current();
        }
      } catch {
        // ignore malformed messages
      }
    };

    ws.onclose = () => {
      if (unmountedRef.current) return;
      const delay = Math.min(1000 * Math.pow(2, reconnectAttempt.current), 30000);
      reconnectAttempt.current++;
      setTimeout(connect, delay);
    };
  }, [animationId]);

  useEffect(() => {
    unmountedRef.current = false;
    connect();

    return () => {
      unmountedRef.current = true;
      wsRef.current?.close();
    };
  }, [connect]);
}
