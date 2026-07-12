import { describe, it, expect, beforeEach } from "vitest";
import { db } from "@/lib/db";

// Seed parent rows needed for FK constraints
function seedParents() {
  db.exec(`INSERT OR IGNORE INTO animations (id, name) VALUES ('anim-1', 'Test Animation')`);
  db.exec(`INSERT OR IGNORE INTO messages (id, animation_id, role, content) VALUES ('msg-a', 'anim-1', 'assistant', 'test')`);
  db.exec(`INSERT OR IGNORE INTO messages (id, animation_id, role, content) VALUES ('msg-b', 'anim-1', 'assistant', 'test')`);
  db.exec(`INSERT OR IGNORE INTO messages (id, animation_id, role, content) VALUES ('msg-c', 'anim-1', 'assistant', 'test')`);
  db.exec(`INSERT OR IGNORE INTO messages (id, animation_id, role, content) VALUES ('msg-1', 'anim-1', 'assistant', 'test')`);
  db.exec(`INSERT OR IGNORE INTO messages (id, animation_id, role, content) VALUES ('msg-2', 'anim-1', 'assistant', 'test')`);
  db.exec(`INSERT OR IGNORE INTO messages (id, animation_id, role, content) VALUES ('msg-3', 'anim-1', 'assistant', 'test')`);
  db.exec(`INSERT OR IGNORE INTO messages (id, animation_id, role, content) VALUES ('msg-4', 'anim-1', 'assistant', 'test')`);
  db.exec(`INSERT OR IGNORE INTO messages (id, animation_id, role, content) VALUES ('msg-5', 'anim-1', 'assistant', 'test')`);
}

function makeReq(body: object) {
  return new Request("http://localhost/api/feedback", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as never;
}

describe("feedback API", () => {
  beforeEach(() => {
    db.exec("DELETE FROM feedback");
    seedParents();
  });

  describe("POST /api/feedback", () => {
    it("creates feedback with rating 1", async () => {
      const { POST } = await import("@/app/api/feedback/route");
      const res = await POST(makeReq({ messageId: "msg-1", animationId: "anim-1", rating: 1 }));
      const data = await res.json();
      expect(res.status).toBe(200);
      expect(data.status).toBe("created");
      expect(data.rating).toBe(1);
    });

    it("creates feedback with rating -1 and comment", async () => {
      const { POST } = await import("@/app/api/feedback/route");
      const res = await POST(makeReq({ messageId: "msg-2", animationId: "anim-1", rating: -1, comment: "Animation was wrong" }));
      const data = await res.json();
      expect(data.status).toBe("created");

      const row = db.prepare("SELECT comment FROM feedback WHERE message_id = ?").get("msg-2") as { comment: string };
      expect(row.comment).toBe("Animation was wrong");
    });

    it("removes feedback when same rating clicked again", async () => {
      const { POST } = await import("@/app/api/feedback/route");
      await POST(makeReq({ messageId: "msg-3", animationId: "anim-1", rating: 1 }));
      const res = await POST(makeReq({ messageId: "msg-3", animationId: "anim-1", rating: 1 }));
      const data = await res.json();
      expect(data.status).toBe("removed");
    });

    it("toggles rating when different rating clicked", async () => {
      const { POST } = await import("@/app/api/feedback/route");
      await POST(makeReq({ messageId: "msg-4", animationId: "anim-1", rating: 1 }));
      const res = await POST(makeReq({ messageId: "msg-4", animationId: "anim-1", rating: -1 }));
      const data = await res.json();
      expect(data.status).toBe("updated");
      expect(data.rating).toBe(-1);
    });

    it("rejects invalid rating", async () => {
      const { POST } = await import("@/app/api/feedback/route");
      const res = await POST(makeReq({ messageId: "msg-5", animationId: "anim-1", rating: 5 }));
      expect(res.status).toBe(400);
    });

    it("rejects missing fields", async () => {
      const { POST } = await import("@/app/api/feedback/route");
      const res = await POST(makeReq({ rating: 1 }));
      expect(res.status).toBe(400);
    });
  });

  describe("GET /api/feedback/stats", () => {
    it("returns aggregate stats", async () => {
      db.prepare("INSERT INTO feedback (id, animation_id, message_id, rating) VALUES (?, ?, ?, ?)").run("f1", "anim-1", "msg-a", 1);
      db.prepare("INSERT INTO feedback (id, animation_id, message_id, rating) VALUES (?, ?, ?, ?)").run("f2", "anim-1", "msg-b", 1);
      db.prepare("INSERT INTO feedback (id, animation_id, message_id, rating) VALUES (?, ?, ?, ?)").run("f3", "anim-1", "msg-c", -1);

      const { GET } = await import("@/app/api/feedback/stats/route");
      const res = await GET();
      const data = await res.json();

      expect(data.totalRatings).toBe(3);
      expect(data.positivePercent).toBe(67);
      expect(data.topRated).toHaveLength(1);
      expect(data.topRated[0].positive_count).toBe(2);
    });

    it("returns zeros when no feedback", async () => {
      const { GET } = await import("@/app/api/feedback/stats/route");
      const res = await GET();
      const data = await res.json();

      expect(data.totalRatings).toBe(0);
      expect(data.positivePercent).toBe(0);
      expect(data.topRated).toHaveLength(0);
    });
  });
});
