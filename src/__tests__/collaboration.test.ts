import { describe, it, expect, vi, beforeEach } from "vitest";
import path from "node:path";

let mockDbData: {
  animations: Map<string, { id: string; user_id: string | null; name: string }>;
  collaborations: Map<string, { id: string; animation_id: string; token: string; permission: string; created_by: string; expires_at: string }>;
  collaborationMembers: Map<string, { id: string; collaboration_id: string; user_id: string }>;
  users: Map<string, { id: string; email: string; display_name: string | null; avatar_url: string | null }>;
};

function resetDb() {
  mockDbData = {
    animations: new Map(),
    collaborations: new Map(),
    collaborationMembers: new Map(),
    users: new Map(),
  };
}

function createMockPrepare() {
  return (sql: string) => ({
    get: (...args: unknown[]) => {
      const sqlLower = sql.toLowerCase();
      if (sqlLower.includes("from animations")) {
        const id = args[0] as string;
        return mockDbData.animations.get(id);
      }
      if (sqlLower.includes("from collaborations") && sqlLower.includes("token")) {
        const token = args[0] as string;
        const animId = args[1] as string;
        for (const c of mockDbData.collaborations.values()) {
          if (c.token === token && c.animation_id === animId) return c;
        }
        return undefined;
      }
      if (sqlLower.includes("count") && sqlLower.includes("collaboration_members")) {
        const collabId = args[0] as string;
        let count = 0;
        for (const m of mockDbData.collaborationMembers.values()) {
          if (m.collaboration_id === collabId) count++;
        }
        return { count };
      }
      if (sqlLower.includes("from users")) {
        const id = args[0] as string;
        return mockDbData.users.get(id);
      }
      if (sqlLower.includes("from collaboration_members") || sqlLower.includes("select 1")) {
        return undefined;
      }
      return undefined;
    },
    all: (..._args: unknown[]) => {
      const sqlLower = sql.toLowerCase();
      if (sqlLower.includes("from collaborations")) {
        const animId = _args[0] as string;
        const now = new Date().toISOString();
        const results: unknown[] = [];
        for (const c of mockDbData.collaborations.values()) {
          if (c.animation_id === animId && c.expires_at > now) {
            let memberCount = 0;
            for (const m of mockDbData.collaborationMembers.values()) {
              if (m.collaboration_id === c.id) memberCount++;
            }
            results.push({ ...c, member_count: memberCount });
          }
        }
        return results;
      }
      return [];
    },
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    run: (..._args: unknown[]) => ({ changes: 1 }),
  });
}

vi.mock("@/lib/db", () => ({
  db: {
    prepare: createMockPrepare(),
  },
  ANIMATIONS_DIR: path.join(process.cwd(), "data", "animations"),
}));

class MockAuthError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "AuthError";
    this.status = status;
  }
}

vi.mock("@/lib/auth-middleware", () => {
  let currentUser: { id: string; email: string; display_name: string | null; avatar_url: string | null } | null = null;

  return {
    requireAuth: () => {
      if (!currentUser) {
        throw new MockAuthError("Authentication required", 401);
      }
      return currentUser;
    },
    getAuthUser: () => currentUser,
    AuthError: MockAuthError,
    __setMockUser: (user: typeof currentUser) => { currentUser = user; },
  };
});

const { __setMockUser } = await import("@/lib/auth-middleware") as unknown as {
  __setMockUser: (user: { id: string; email: string; display_name: string | null; avatar_url: string | null } | null) => void;
};

describe("collaboration", () => {
  const ownerId = "owner-123";
  const ownerUser = { id: ownerId, email: "owner@test.com", display_name: "Owner", avatar_url: null };
  const otherUserId = "other-456";
  const otherUser = { id: otherUserId, email: "other@test.com", display_name: "Other", avatar_url: null };
  const animationId = "anim-789";

  beforeEach(() => {
    resetDb();
    mockDbData.users.set(ownerId, ownerUser);
    mockDbData.users.set(otherUserId, otherUser);
    mockDbData.animations.set(animationId, { id: animationId, user_id: ownerId, name: "Test Animation" });
    __setMockUser(null);
  });

  describe("token generation and expiration", () => {
    it("should create a collaboration with a valid UUID token", async () => {
      __setMockUser(ownerUser);

      const { POST } = await import("@/app/api/animations/[id]/collaborate/route");
      const request = new Request("http://localhost/api/animations/anim-789/collaborate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ permission: "edit" }),
      });

      const response = await POST(request, { params: Promise.resolve({ id: animationId }) });
      expect(response.status).toBe(201);

      const data = await response.json();
      expect(data.token).toBeDefined();
      expect(data.permission).toBe("edit");
      expect(data.expiresAt).toBeDefined();
      expect(data.url).toContain(animationId);

      const expires = new Date(data.expiresAt);
      const now = new Date();
      const diffHours = (expires.getTime() - now.getTime()) / (1000 * 60 * 60);
      expect(diffHours).toBeGreaterThan(23);
      expect(diffHours).toBeLessThanOrEqual(24);
    });

    it("should reject invalid permission values", async () => {
      __setMockUser(ownerUser);

      const { POST } = await import("@/app/api/animations/[id]/collaborate/route");
      const request = new Request("http://localhost/api/animations/anim-789/collaborate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ permission: "admin" }),
      });

      const response = await POST(request, { params: Promise.resolve({ id: animationId }) });
      expect(response.status).toBe(400);
    });
  });

  describe("permission enforcement", () => {
    it("should only allow the owner to create collaboration links", async () => {
      __setMockUser(otherUser);

      const { POST } = await import("@/app/api/animations/[id]/collaborate/route");
      const request = new Request("http://localhost/api/animations/anim-789/collaborate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ permission: "edit" }),
      });

      const response = await POST(request, { params: Promise.resolve({ id: animationId }) });
      expect(response.status).toBe(403);
    });

    it("should only allow the owner to list collaborations", async () => {
      __setMockUser(otherUser);

      const { GET } = await import("@/app/api/animations/[id]/collaborate/route");
      const request = new Request("http://localhost/api/animations/anim-789/collaborate");

      const response = await GET(request, { params: Promise.resolve({ id: animationId }) });
      expect(response.status).toBe(403);
    });

    it("should only allow the owner to revoke collaborations", async () => {
      __setMockUser(otherUser);

      const { DELETE } = await import("@/app/api/animations/[id]/collaborate/[token]/route");
      const request = new Request("http://localhost/api/animations/anim-789/collaborate/some-token", {
        method: "DELETE",
      });

      const response = await DELETE(request, { params: Promise.resolve({ id: animationId, token: "some-token" }) });
      expect(response.status).toBe(403);
    });

    it("should require authentication", async () => {
      __setMockUser(null);

      const { POST } = await import("@/app/api/animations/[id]/collaborate/route");
      const request = new Request("http://localhost/api/animations/anim-789/collaborate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ permission: "edit" }),
      });

      const response = await POST(request, { params: Promise.resolve({ id: animationId }) });
      expect(response.status).toBe(401);
    });
  });

  describe("join with token", () => {
    it("should reject join with missing token", async () => {
      __setMockUser(otherUser);

      const { POST } = await import("@/app/api/animations/[id]/collaborate/join/route");
      const request = new Request("http://localhost/api/animations/anim-789/collaborate/join", {
        method: "POST",
      });

      const response = await POST(request, { params: Promise.resolve({ id: animationId }) });
      expect(response.status).toBe(400);
    });

    it("should reject join with invalid token", async () => {
      __setMockUser(otherUser);

      const { POST } = await import("@/app/api/animations/[id]/collaborate/join/route");
      const request = new Request("http://localhost/api/animations/anim-789/collaborate/join?token=invalid-token", {
        method: "POST",
      });

      const response = await POST(request, { params: Promise.resolve({ id: animationId }) });
      expect(response.status).toBe(404);
    });

    it("should reject join with expired token", async () => {
      const collabId = "collab-expired";
      const expiredToken = "expired-token";
      mockDbData.collaborations.set(collabId, {
        id: collabId,
        animation_id: animationId,
        token: expiredToken,
        permission: "edit",
        created_by: ownerId,
        expires_at: new Date(Date.now() - 1000).toISOString(),
      });

      __setMockUser(otherUser);

      const { POST } = await import("@/app/api/animations/[id]/collaborate/join/route");
      const request = new Request(`http://localhost/api/animations/anim-789/collaborate/join?token=${expiredToken}`, {
        method: "POST",
      });

      const response = await POST(request, { params: Promise.resolve({ id: animationId }) });
      expect(response.status).toBe(410);
    });

    it("should allow join with valid token", async () => {
      const collabId = "collab-valid";
      const validToken = "valid-token";
      mockDbData.collaborations.set(collabId, {
        id: collabId,
        animation_id: animationId,
        token: validToken,
        permission: "edit",
        created_by: ownerId,
        expires_at: new Date(Date.now() + 86400000).toISOString(),
      });

      __setMockUser(otherUser);

      const { POST } = await import("@/app/api/animations/[id]/collaborate/join/route");
      const request = new Request(`http://localhost/api/animations/anim-789/collaborate/join?token=${validToken}`, {
        method: "POST",
      });

      const response = await POST(request, { params: Promise.resolve({ id: animationId }) });
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.collaborationId).toBe(collabId);
      expect(data.permission).toBe("edit");
      expect(data.animation).toBeDefined();
      expect(data.animation.name).toBe("Test Animation");
    });
  });

  describe("collaborator listing", () => {
    it("should return 404 for non-existent animation", async () => {
      __setMockUser(ownerUser);

      const { GET } = await import("@/app/api/animations/[id]/collaborators/route");
      const request = new Request("http://localhost/api/animations/nonexistent/collaborators");

      const response = await GET(request, { params: Promise.resolve({ id: "nonexistent" }) });
      expect(response.status).toBe(404);
    });

    it("should allow the owner to list collaborators", async () => {
      __setMockUser(ownerUser);

      const { GET } = await import("@/app/api/animations/[id]/collaborators/route");
      const request = new Request("http://localhost/api/animations/anim-789/collaborators");

      const response = await GET(request, { params: Promise.resolve({ id: animationId }) });
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.collaborators).toBeDefined();
      expect(Array.isArray(data.collaborators)).toBe(true);
    });

    it("should deny non-member non-owner access", async () => {
      __setMockUser(otherUser);

      const { GET } = await import("@/app/api/animations/[id]/collaborators/route");
      const request = new Request("http://localhost/api/animations/anim-789/collaborators");

      const response = await GET(request, { params: Promise.resolve({ id: animationId }) });
      expect(response.status).toBe(403);
    });
  });

  describe("max collaborators limit", () => {
    it("should reject join when max collaborators reached", async () => {
      const collabId = "collab-full";
      const fullToken = "full-token";
      mockDbData.collaborations.set(collabId, {
        id: collabId,
        animation_id: animationId,
        token: fullToken,
        permission: "edit",
        created_by: ownerId,
        expires_at: new Date(Date.now() + 86400000).toISOString(),
      });

      for (let i = 0; i < 5; i++) {
        const memberId = `member-${i}`;
        mockDbData.collaborationMembers.set(memberId, {
          id: memberId,
          collaboration_id: collabId,
          user_id: `user-${i}`,
        });
      }

      __setMockUser(otherUser);

      const { POST } = await import("@/app/api/animations/[id]/collaborate/join/route");
      const request = new Request(`http://localhost/api/animations/anim-789/collaborate/join?token=${fullToken}`, {
        method: "POST",
      });

      const response = await POST(request, { params: Promise.resolve({ id: animationId }) });
      expect(response.status).toBe(409);

      const data = await response.json();
      expect(data.error).toContain("Maximum");
    });
  });

  describe("owner self-view", () => {
    it("should allow owner to access collaborators without token", async () => {
      __setMockUser(ownerUser);

      const { GET } = await import("@/app/api/animations/[id]/collaborators/route");
      const request = new Request("http://localhost/api/animations/anim-789/collaborators");

      const response = await GET(request, { params: Promise.resolve({ id: animationId }) });
      expect(response.status).toBe(200);

      const data = await response.json();
      const ownerEntry = data.collaborators.find((c: { isOwner: boolean }) => c.isOwner);
      expect(ownerEntry).toBeDefined();
      expect(ownerEntry.permission).toBe("owner");
    });
  });
});
