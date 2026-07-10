import { describe, it, expect } from "vitest";
import { db } from "@/lib/db";

describe("template-marketplace", () => {
  function createTestAnimation() {
    const id = `test-anim-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    db.prepare(
      "INSERT INTO animations (id, name, frame_count) VALUES (?, ?, 30)"
    ).run(id, "Test Animation");
    return id;
  }

  describe("POST /api/templates/submit", () => {
    it("creates a pending submission", async () => {
      const animationId = createTestAnimation();
      const { POST } = await import("@/app/api/templates/submit/route");

      const res = await POST(
        new Request("http://localhost/api/templates/submit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            animationId,
            title: "My Template",
            description: "A cool animation",
            category: "Motion",
            tags: ["loading", "spinner"],
          }),
        })
      );

      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.title).toBe("My Template");
      expect(data.status).toBe("pending");
      expect(data.category).toBe("Motion");
      expect(data.tags).toBe("loading,spinner");
    });

    it("returns 400 when title is missing", async () => {
      const animationId = createTestAnimation();
      const { POST } = await import("@/app/api/templates/submit/route");

      const res = await POST(
        new Request("http://localhost/api/templates/submit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ animationId }),
        })
      );

      expect(res.status).toBe(400);
    });

    it("returns 404 for non-existent animation", async () => {
      const { POST } = await import("@/app/api/templates/submit/route");

      const res = await POST(
        new Request("http://localhost/api/templates/submit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ animationId: "nonexistent", title: "Test" }),
        })
      );

      expect(res.status).toBe(404);
    });
  });

  describe("GET /api/templates/submissions", () => {
    it("returns 401 without admin token", async () => {
      const { GET } = await import("@/app/api/templates/submissions/route");

      const res = await GET(
        new Request("http://localhost/api/templates/submissions?status=pending")
      );

      expect(res.status).toBe(401);
    });

    it("returns submissions with valid admin token", async () => {
      const animationId = createTestAnimation();
      const subId = `sub-list-${Date.now()}`;
      db.prepare(
        "INSERT INTO template_submissions (id, animation_id, title, status) VALUES (?, ?, ?, 'pending')"
      ).run(subId, animationId, "Test Sub");

      const { GET } = await import("@/app/api/templates/submissions/route");

      const res = await GET(
        new Request("http://localhost/api/templates/submissions?status=pending", {
          headers: { "X-Admin-Token": "admin" },
        })
      );

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("PATCH /api/templates/submissions/[id]", () => {
    it("approves a submission and shares the animation", async () => {
      const animationId = createTestAnimation();
      const subId = `sub-approve-${Date.now()}`;
      db.prepare(
        "INSERT INTO template_submissions (id, animation_id, title, status) VALUES (?, ?, ?, 'pending')"
      ).run(subId, animationId, "Approve Me");

      const { PATCH } = await import("@/app/api/templates/submissions/[id]/route");

      const res = await PATCH(
        new Request(`http://localhost/api/templates/submissions/${subId}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "X-Admin-Token": "admin",
          },
          body: JSON.stringify({ status: "approved", reviewerNotes: "Looks great" }),
        }),
        { params: Promise.resolve({ id: subId }) }
      );

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.status).toBe("approved");
      expect(data.reviewer_notes).toBe("Looks great");
      expect(data.reviewed_at).toBeTruthy();

      const anim = db.prepare("SELECT share_chat FROM animations WHERE id = ?").get(animationId) as { share_chat: number };
      expect(anim.share_chat).toBe(1);
    });

    it("rejects a submission", async () => {
      const animationId = createTestAnimation();
      const subId = `sub-reject-${Date.now()}`;
      db.prepare(
        "INSERT INTO template_submissions (id, animation_id, title, status) VALUES (?, ?, ?, 'pending')"
      ).run(subId, animationId, "Reject Me");

      const { PATCH } = await import("@/app/api/templates/submissions/[id]/route");

      const res = await PATCH(
        new Request(`http://localhost/api/templates/submissions/${subId}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "X-Admin-Token": "admin",
          },
          body: JSON.stringify({ status: "rejected" }),
        }),
        { params: Promise.resolve({ id: subId }) }
      );

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.status).toBe("rejected");
    });

    it("returns 401 without admin token", async () => {
      const { PATCH } = await import("@/app/api/templates/submissions/[id]/route");

      const res = await PATCH(
        new Request("http://localhost/api/templates/submissions/test-id", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "approved" }),
        }),
        { params: Promise.resolve({ id: "test-id" }) }
      );

      expect(res.status).toBe(401);
    });

    it("returns 400 for invalid status", async () => {
      const { PATCH } = await import("@/app/api/templates/submissions/[id]/route");

      const res = await PATCH(
        new Request("http://localhost/api/templates/submissions/test-id", {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "X-Admin-Token": "admin",
          },
          body: JSON.stringify({ status: "invalid" }),
        }),
        { params: Promise.resolve({ id: "test-id" }) }
      );

      expect(res.status).toBe(400);
    });
  });

  describe("GET /api/templates/community", () => {
    it("returns only approved submissions", async () => {
      const animationId = createTestAnimation();
      const approvedId = `community-${Date.now()}`;
      db.prepare(
        "INSERT INTO template_submissions (id, animation_id, title, status, reviewed_at) VALUES (?, ?, ?, 'approved', datetime('now'))"
      ).run(approvedId, animationId, "Community Template");
      db.prepare(
        "INSERT INTO template_submissions (id, animation_id, title, status) VALUES (?, ?, ?, 'pending')"
      ).run(`pending-${Date.now()}`, animationId, "Pending One");

      const { GET } = await import("@/app/api/templates/community/route");

      const res = await GET();
      expect(res.status).toBe(200);
      const data = await res.json();
      const allApproved = data.every((s: { status: string }) => s.status === "approved");
      expect(allApproved).toBe(true);
    });
  });
});
