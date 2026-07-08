import { useEffect, useRef, useState, useCallback } from "react";

export interface CollabMember {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  permission: "edit" | "view" | "owner";
  status: "online" | "idle";
}

export interface CollabMessage {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  content: string;
  timestamp: string;
}

interface UseCollaborationOptions {
  animationId: string | null;
  token: string | null;
  userId: string | null;
  displayName: string | null;
  avatarUrl: string | null;
}

export function useCollaboration({
  animationId,
  token,
  userId,
  displayName,
  avatarUrl,
}: UseCollaborationOptions) {
  const [members, setMembers] = useState<CollabMember[]>([]);
  const [permission, setPermission] = useState<"edit" | "view" | "owner" | null>(null);
  const [isCollaborating, setIsCollaborating] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  const sendMessage = useCallback((content: string) => {
    const ws = wsRef.current;
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "collab:message", content }));
    }
  }, []);

  useEffect(() => {
    if (!animationId || !token || !userId || !displayName) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const url = `${protocol}//${window.location.host}/ws?animationId=${encodeURIComponent(animationId)}`;
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(
        JSON.stringify({
          type: "collab:join",
          token,
          userId,
          displayName,
          avatarUrl,
        })
      );
      setIsCollaborating(true);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        switch (data.type) {
          case "collab:members":
            setMembers(data.members);
            break;
          case "collab:user_joined":
            setMembers((prev) => {
              if (prev.some((m) => m.userId === data.user.userId)) return prev;
              return [...prev, { ...data.user, status: "online" }];
            });
            break;
          case "collab:user_left":
            setMembers((prev) => prev.filter((m) => m.userId !== data.user.userId));
            break;
          case "collab:error":
            setIsCollaborating(false);
            break;
        }
      } catch {
        // ignore
      }
    };

    ws.onclose = () => {
      setIsCollaborating(false);
    };

    const heartbeat = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "collab:activity" }));
      }
    }, 30_000);

    return () => {
      clearInterval(heartbeat);
      ws.close();
      wsRef.current = null;
      setIsCollaborating(false);
      setMembers([]);
    };
  }, [animationId, token, userId, displayName, avatarUrl]);

  useEffect(() => {
    if (!isCollaborating || !userId) return;
    const me = members.find((m) => m.userId === userId);
    if (me) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPermission(me.permission);
    }
  }, [members, userId, isCollaborating]);

  return { members, isCollaborating, permission, sendMessage };
}
