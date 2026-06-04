import { createServer } from "node:http";
import { parse } from "node:url";
import next from "next";
import { WebSocketServer, WebSocket } from "ws";
import { animationEvents, type AnimationUpdatedEvent } from "./src/lib/events";

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME || "0.0.0.0";
const port = parseInt(process.env.PORT || "3000", 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// Map animationId -> Set of connected WebSocket clients
const clients = new Map<string, Set<WebSocket>>();

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

    ws.on("close", () => {
      const set = clients.get(animationId);
      if (set) {
        set.delete(ws);
        if (set.size === 0) clients.delete(animationId);
      }
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
