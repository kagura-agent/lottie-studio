import { createServer } from "node:http";
import { parse } from "node:url";
import next from "next";
import { WebSocketServer, WebSocket } from "ws";
import { animationEvents, type AnimationUpdatedEvent } from "./src/lib/events";
import { db } from "./src/lib/db";

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME || "0.0.0.0";
const port = parseInt(process.env.PORT || "3000", 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// Map animationId -> Set of connected WebSocket clients
const clients = new Map<string, Set<WebSocket>>();

// --- Collaboration presence ---

interface CollabClient {
  ws: WebSocket;
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  permission: "edit" | "view" | "owner";
  lastActivity: number;
}

const collabMembers = new Map<string, Map<string, CollabClient>>();

const IDLE_THRESHOLD_MS = 2 * 60 * 1000;
const DISCONNECT_DELAY_MS = 5000;

const pendingDisconnects = new Map<string, ReturnType<typeof setTimeout>>();

function broadcastCollabMembers(animationId: string) {
  const members = collabMembers.get(animationId);
  if (!members) return;

  const now = Date.now();
  const memberList = Array.from(members.values()).map((m) => ({
    userId: m.userId,
    displayName: m.displayName,
    avatarUrl: m.avatarUrl,
    permission: m.permission,
    status: now - m.lastActivity > IDLE_THRESHOLD_MS ? "idle" : "online",
  }));

  const message = JSON.stringify({ type: "collab:members", members: memberList });
  const animClients = clients.get(animationId);
  if (!animClients) return;
  for (const ws of animClients) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(message);
    }
  }
}

function handleCollabMessage(ws: WebSocket, animationId: string, data: Record<string, unknown>) {
  const type = data.type as string;

  if (type === "collab:join") {
    const token = data.token as string;
    const userId = data.userId as string;
    const displayName = data.displayName as string;
    const avatarUrl = (data.avatarUrl as string | null) || null;

    if (!token || !userId || !displayName) return;

    const collab = (db as import("better-sqlite3").Database)
      .prepare(
        `SELECT c.id, c.permission, c.animation_id
         FROM collaborations c
         WHERE c.token = ? AND c.animation_id = ? AND c.expires_at > datetime('now')`
      )
      .get(token, animationId) as { id: string; permission: string; animation_id: string } | undefined;

    if (!collab) {
      ws.send(JSON.stringify({ type: "collab:error", error: "Invalid or expired token" }));
      return;
    }

    const disconnectKey = `${animationId}:${userId}`;
    const pendingTimeout = pendingDisconnects.get(disconnectKey);
    if (pendingTimeout) {
      clearTimeout(pendingTimeout);
      pendingDisconnects.delete(disconnectKey);
    }

    if (!collabMembers.has(animationId)) {
      collabMembers.set(animationId, new Map());
    }

    const members = collabMembers.get(animationId)!;
    const isReconnect = members.has(userId);

    members.set(userId, {
      ws,
      userId,
      displayName,
      avatarUrl,
      permission: collab.permission as "edit" | "view",
      lastActivity: Date.now(),
    });

    (ws as WebSocket & { _collabUserId?: string; _collabAnimationId?: string })._collabUserId = userId;
    (ws as WebSocket & { _collabAnimationId?: string })._collabAnimationId = animationId;

    if (!isReconnect) {
      const joinMsg = JSON.stringify({
        type: "collab:user_joined",
        user: { userId, displayName, avatarUrl, permission: collab.permission },
      });
      const animClients = clients.get(animationId);
      if (animClients) {
        for (const client of animClients) {
          if (client !== ws && client.readyState === WebSocket.OPEN) {
            client.send(joinMsg);
          }
        }
      }
    }

    broadcastCollabMembers(animationId);
  } else if (type === "collab:activity") {
    const extWs = ws as WebSocket & { _collabUserId?: string };
    const userId = extWs._collabUserId;
    if (!userId) return;

    const members = collabMembers.get(animationId);
    if (!members) return;

    const member = members.get(userId);
    if (member) {
      member.lastActivity = Date.now();
    }
  } else if (type === "collab:message") {
    const extWs = ws as WebSocket & { _collabUserId?: string };
    const userId = extWs._collabUserId;
    if (!userId) return;

    const members = collabMembers.get(animationId);
    if (!members) return;

    const sender = members.get(userId);
    if (!sender) return;

    const content = data.content as string;
    if (!content?.trim()) return;

    const chatMsg = JSON.stringify({
      type: "collab:message",
      userId,
      displayName: sender.displayName,
      avatarUrl: sender.avatarUrl,
      content: content.trim(),
      timestamp: new Date().toISOString(),
    });

    const animClients = clients.get(animationId);
    if (animClients) {
      for (const client of animClients) {
        if (client !== ws && client.readyState === WebSocket.OPEN) {
          client.send(chatMsg);
        }
      }
    }
  }
}

function handleCollabDisconnect(ws: WebSocket, animationId: string) {
  const extWs = ws as WebSocket & { _collabUserId?: string };
  const userId = extWs._collabUserId;
  if (!userId) return;

  const disconnectKey = `${animationId}:${userId}`;

  pendingDisconnects.set(
    disconnectKey,
    setTimeout(() => {
      pendingDisconnects.delete(disconnectKey);
      const members = collabMembers.get(animationId);
      if (!members) return;

      const member = members.get(userId);
      if (member && member.ws === ws) {
        members.delete(userId);

        if (members.size === 0) {
          collabMembers.delete(animationId);
        }

        const leftMsg = JSON.stringify({ type: "collab:user_left", user: { userId } });
        const animClients = clients.get(animationId);
        if (animClients) {
          for (const client of animClients) {
            if (client.readyState === WebSocket.OPEN) {
              client.send(leftMsg);
            }
          }
        }

        broadcastCollabMembers(animationId);
      }
    }, DISCONNECT_DELAY_MS)
  );
}

app.prepare().then(() => {
  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url!, true);
    handle(req, res, parsedUrl);
  });

  const wss = new WebSocketServer({ server, path: "/ws" });

  wss.on("connection", (ws, req) => {
    const url = parse(req.url!, true);
    const animationId = url.query.animationId as string | undefined;

    if (!animationId) {
      ws.close(1008, "animationId query param required");
      return;
    }

    if (!clients.has(animationId)) {
      clients.set(animationId, new Set());
    }
    clients.get(animationId)!.add(ws);

    ws.on("message", (raw) => {
      try {
        const data = JSON.parse(raw.toString()) as Record<string, unknown>;
        const type = data.type as string;
        if (type?.startsWith("collab:")) {
          handleCollabMessage(ws, animationId, data);
        }
      } catch {
        // ignore malformed messages
      }
    });

    ws.on("close", () => {
      const set = clients.get(animationId);
      if (set) {
        set.delete(ws);
        if (set.size === 0) clients.delete(animationId);
      }

      handleCollabDisconnect(ws, animationId);
    });
  });

  animationEvents.on("updated", (event: AnimationUpdatedEvent) => {
    const set = clients.get(event.animationId);
    if (!set) return;
    const message = JSON.stringify({ type: "updated", animationId: event.animationId });
    for (const ws of set) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(message);
      }
    }
  });

  server.listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
  });
});
