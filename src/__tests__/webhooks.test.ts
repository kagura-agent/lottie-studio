import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import crypto from "node:crypto";
import { verifySignature } from "@/lib/webhook-crypto";

describe("webhooks", () => {
  let dispatchWebhookEvent: typeof import("@/lib/webhooks").dispatchWebhookEvent;
  let db: typeof import("@/lib/db").db;

  beforeEach(async () => {
    vi.resetModules();
    const webhookMod = await import("@/lib/webhooks");
    dispatchWebhookEvent = webhookMod.dispatchWebhookEvent;
    const dbMod = await import("@/lib/db");
    db = dbMod.db;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("verifySignature", () => {
    it("returns true for valid signature", () => {
      const secret = "whsec_testSecretValue123";
      const payload = JSON.stringify({ event: "animation.created", data: {} });
      const sig = `sha256=${crypto.createHmac("sha256", secret).update(payload).digest("hex")}`;
      expect(verifySignature(payload, sig, secret)).toBe(true);
    });

    it("returns false for invalid signature", () => {
      const secret = "whsec_testSecretValue123";
      const payload = JSON.stringify({ event: "animation.created", data: {} });
      const badSig = `sha256=${"a".repeat(64)}`;
      expect(verifySignature(payload, badSig, secret)).toBe(false);
    });

    it("returns false for tampered payload", () => {
      const secret = "whsec_testSecretValue123";
      const original = JSON.stringify({ event: "animation.created" });
      const sig = `sha256=${crypto.createHmac("sha256", secret).update(original).digest("hex")}`;
      const tampered = JSON.stringify({ event: "animation.deleted" });
      expect(verifySignature(tampered, sig, secret)).toBe(false);
    });
  });

  describe("webhook CRUD (database)", () => {
    const userId = "test-user-webhook";

    beforeEach(() => {
      // Ensure test user exists
      db.prepare(
        "INSERT OR IGNORE INTO users (id, email, password_hash, display_name) VALUES (?, ?, ?, ?)"
      ).run(userId, "webhook@test.local", "hash", "Webhook Tester");
      // Clean up any test webhooks
      db.prepare("DELETE FROM webhooks WHERE user_id = ?").run(userId);
    });

    it("creates a webhook with proper fields", () => {
      const id = crypto.randomUUID();
      const secret = `whsec_${crypto.randomBytes(24).toString("base64url")}`;
      db.prepare(
        "INSERT INTO webhooks (id, user_id, url, secret, events, format) VALUES (?, ?, ?, ?, ?, ?)"
      ).run(id, userId, "https://example.com/hook", secret, JSON.stringify(["animation.created"]), "generic");

      const row = db.prepare("SELECT * FROM webhooks WHERE id = ?").get(id) as Record<string, unknown>;
      expect(row).toBeDefined();
      expect(row.url).toBe("https://example.com/hook");
      expect(row.secret).toBe(secret);
      expect(row.active).toBe(1);
      expect(JSON.parse(row.events as string)).toEqual(["animation.created"]);
      expect(row.format).toBe("generic");
    });

    it("enforces format constraint", () => {
      const id = crypto.randomUUID();
      expect(() => {
        db.prepare(
          "INSERT INTO webhooks (id, user_id, url, secret, events, format) VALUES (?, ?, ?, ?, ?, ?)"
        ).run(id, userId, "https://example.com", "secret", "[]", "invalid");
      }).toThrow();
    });

    it("cascades delete to deliveries", () => {
      const webhookId = crypto.randomUUID();
      const deliveryId = crypto.randomUUID();
      db.prepare(
        "INSERT INTO webhooks (id, user_id, url, secret, events, format) VALUES (?, ?, ?, ?, ?, ?)"
      ).run(webhookId, userId, "https://example.com", "secret", "[]", "generic");
      db.prepare(
        "INSERT INTO webhook_deliveries (id, webhook_id, event, payload, success) VALUES (?, ?, ?, ?, ?)"
      ).run(deliveryId, webhookId, "animation.created", "{}", 1);

      db.prepare("DELETE FROM webhooks WHERE id = ?").run(webhookId);

      const delivery = db.prepare("SELECT * FROM webhook_deliveries WHERE id = ?").get(deliveryId);
      expect(delivery).toBeUndefined();
    });
  });

  describe("dispatchWebhookEvent", () => {
    const userId = "test-user-dispatch";

    beforeEach(() => {
      db.prepare(
        "INSERT OR IGNORE INTO users (id, email, password_hash, display_name) VALUES (?, ?, ?, ?)"
      ).run(userId, "dispatch@test.local", "hash", "Dispatch Tester");
      db.prepare("DELETE FROM webhooks WHERE user_id = ?").run(userId);
      db.prepare("DELETE FROM webhook_deliveries WHERE webhook_id IN (SELECT id FROM webhooks WHERE user_id = ?)").run(userId);
    });

    it("only dispatches to webhooks matching event", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response("ok", { status: 200 })
      );

      const id1 = crypto.randomUUID();
      const id2 = crypto.randomUUID();
      db.prepare(
        "INSERT INTO webhooks (id, user_id, url, secret, events, format) VALUES (?, ?, ?, ?, ?, ?)"
      ).run(id1, userId, "https://a.com/hook", "sec1", JSON.stringify(["animation.created"]), "generic");
      db.prepare(
        "INSERT INTO webhooks (id, user_id, url, secret, events, format) VALUES (?, ?, ?, ?, ?, ?)"
      ).run(id2, userId, "https://b.com/hook", "sec2", JSON.stringify(["animation.liked"]), "generic");

      await dispatchWebhookEvent("animation.created", { test: true }, userId);

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(fetchSpy.mock.calls[0][0]).toBe("https://a.com/hook");

      fetchSpy.mockRestore();
    });

    it("skips inactive webhooks", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response("ok", { status: 200 })
      );

      const id = crypto.randomUUID();
      db.prepare(
        "INSERT INTO webhooks (id, user_id, url, secret, events, format, active) VALUES (?, ?, ?, ?, ?, ?, ?)"
      ).run(id, userId, "https://c.com/hook", "sec", JSON.stringify(["animation.created"]), "generic", 0);

      await dispatchWebhookEvent("animation.created", { test: true }, userId);

      expect(fetchSpy).not.toHaveBeenCalled();
      fetchSpy.mockRestore();
    });

    it("logs delivery result", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response("received", { status: 200 })
      );

      const id = crypto.randomUUID();
      db.prepare(
        "INSERT INTO webhooks (id, user_id, url, secret, events, format) VALUES (?, ?, ?, ?, ?, ?)"
      ).run(id, userId, "https://d.com/hook", "sec", JSON.stringify(["animation.created"]), "generic");

      await dispatchWebhookEvent("animation.created", { animationId: "anim1" }, userId);

      const deliveries = db.prepare(
        "SELECT * FROM webhook_deliveries WHERE webhook_id = ?"
      ).all(id) as { event: string; success: number; status_code: number }[];

      expect(deliveries).toHaveLength(1);
      expect(deliveries[0].event).toBe("animation.created");
      expect(deliveries[0].success).toBe(1);
      expect(deliveries[0].status_code).toBe(200);

      vi.restoreAllMocks();
    });

    it("includes HMAC signature in request headers", async () => {
      const secret = "whsec_testSig";
      let capturedHeaders: Headers | undefined;

      vi.spyOn(globalThis, "fetch").mockImplementation(async (_url, init) => {
        capturedHeaders = new Headers((init as RequestInit).headers);
        return new Response("ok", { status: 200 });
      });

      const id = crypto.randomUUID();
      db.prepare(
        "INSERT INTO webhooks (id, user_id, url, secret, events, format) VALUES (?, ?, ?, ?, ?, ?)"
      ).run(id, userId, "https://e.com/hook", secret, JSON.stringify(["animation.created"]), "generic");

      await dispatchWebhookEvent("animation.created", { test: true }, userId);

      expect(capturedHeaders).toBeDefined();
      const sig = capturedHeaders!.get("X-Lottie-Signature");
      expect(sig).toMatch(/^sha256=[0-9a-f]{64}$/);

      vi.restoreAllMocks();
    });
  });

  describe("deliver retry logic", () => {
    const userId = "test-user-retry";

    beforeEach(() => {
      vi.useFakeTimers();
      db.prepare(
        "INSERT OR IGNORE INTO users (id, email, password_hash, display_name) VALUES (?, ?, ?, ?)"
      ).run(userId, "retry@test.local", "hash", "Retry Tester");
      db.prepare("DELETE FROM webhooks WHERE user_id = ?").run(userId);
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    function insertWebhook(id: string) {
      db.prepare(
        "INSERT INTO webhooks (id, user_id, url, secret, events, format) VALUES (?, ?, ?, ?, ?, ?)"
      ).run(id, userId, "https://retry.com/hook", "sec", JSON.stringify(["animation.created"]), "generic");
    }

    it("retries on 5xx and succeeds on second attempt", async () => {
      const id = crypto.randomUUID();
      insertWebhook(id);

      let callCount = 0;
      vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
        callCount++;
        if (callCount === 1) return new Response("error", { status: 500 });
        return new Response("ok", { status: 200 });
      });

      const promise = dispatchWebhookEvent("animation.created", { test: true }, userId);
      await vi.advanceTimersByTimeAsync(1000);
      await promise;

      expect(callCount).toBe(2);
      const deliveries = db.prepare("SELECT * FROM webhook_deliveries WHERE webhook_id = ?").all(id) as { success: number }[];
      expect(deliveries[0].success).toBe(1);
    });

    it("returns failure after all retries exhausted on network errors", async () => {
      const id = crypto.randomUUID();
      insertWebhook(id);

      vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("connection refused"));

      const promise = dispatchWebhookEvent("animation.created", { test: true }, userId);
      await vi.advanceTimersByTimeAsync(1000);
      await vi.advanceTimersByTimeAsync(4000);
      await promise;

      const deliveries = db.prepare("SELECT * FROM webhook_deliveries WHERE webhook_id = ?").all(id) as { success: number; status_code: number | null }[];
      expect(deliveries[0].success).toBe(0);
      expect(deliveries[0].status_code).toBeNull();
    });

    it("does not retry on 4xx errors", async () => {
      const id = crypto.randomUUID();
      insertWebhook(id);

      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response("bad request", { status: 400 })
      );

      const promise = dispatchWebhookEvent("animation.created", { test: true }, userId);
      await promise;

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const deliveries = db.prepare("SELECT * FROM webhook_deliveries WHERE webhook_id = ?").all(id) as { success: number; status_code: number }[];
      expect(deliveries[0].success).toBe(0);
      expect(deliveries[0].status_code).toBe(400);
    });
  });

  describe("global dispatch (no userId)", () => {
    const userA = "test-user-global-a";
    const userB = "test-user-global-b";

    beforeEach(() => {
      for (const u of [userA, userB]) {
        db.prepare(
          "INSERT OR IGNORE INTO users (id, email, password_hash, display_name) VALUES (?, ?, ?, ?)"
        ).run(u, `${u}@test.local`, "hash", "Tester");
        db.prepare("DELETE FROM webhooks WHERE user_id = ?").run(u);
      }
    });

    it("dispatches to all active webhooks across users when no userId given", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response("ok", { status: 200 })
      );

      const idA = crypto.randomUUID();
      const idB = crypto.randomUUID();
      db.prepare(
        "INSERT INTO webhooks (id, user_id, url, secret, events, format) VALUES (?, ?, ?, ?, ?, ?)"
      ).run(idA, userA, "https://a.com/hook", "sec", JSON.stringify(["animation.created"]), "generic");
      db.prepare(
        "INSERT INTO webhooks (id, user_id, url, secret, events, format) VALUES (?, ?, ?, ?, ?, ?)"
      ).run(idB, userB, "https://b.com/hook", "sec", JSON.stringify(["animation.created"]), "generic");

      await dispatchWebhookEvent("animation.created", { test: true });

      const urls = fetchSpy.mock.calls.map(c => c[0]);
      expect(urls).toContain("https://a.com/hook");
      expect(urls).toContain("https://b.com/hook");
      fetchSpy.mockRestore();
    });
  });

  describe("payload formatting", () => {
    const userId = "test-user-format";

    beforeEach(() => {
      db.prepare(
        "INSERT OR IGNORE INTO users (id, email, password_hash, display_name) VALUES (?, ?, ?, ?)"
      ).run(userId, "format@test.local", "hash", "Format Tester");
      db.prepare("DELETE FROM webhooks WHERE user_id = ?").run(userId);
    });

    it("formats slack payload with attachments", async () => {
      let capturedBody: string | undefined;
      vi.spyOn(globalThis, "fetch").mockImplementation(async (_url, init) => {
        capturedBody = (init as RequestInit).body as string;
        return new Response("ok", { status: 200 });
      });

      const id = crypto.randomUUID();
      db.prepare(
        "INSERT INTO webhooks (id, user_id, url, secret, events, format) VALUES (?, ?, ?, ?, ?, ?)"
      ).run(id, userId, "https://slack.com/hook", "sec", JSON.stringify(["animation.created"]), "slack");

      await dispatchWebhookEvent("animation.created", { name: "Test" }, userId);

      const parsed = JSON.parse(capturedBody!);
      expect(parsed.text).toContain("animation.created");
      expect(parsed.attachments).toHaveLength(1);
      expect(parsed.attachments[0].color).toBe("#6366f1");

      vi.restoreAllMocks();
    });

    it("formats discord payload with embeds", async () => {
      let capturedBody: string | undefined;
      vi.spyOn(globalThis, "fetch").mockImplementation(async (_url, init) => {
        capturedBody = (init as RequestInit).body as string;
        return new Response("ok", { status: 200 });
      });

      const id = crypto.randomUUID();
      db.prepare(
        "INSERT INTO webhooks (id, user_id, url, secret, events, format) VALUES (?, ?, ?, ?, ?, ?)"
      ).run(id, userId, "https://discord.com/hook", "sec", JSON.stringify(["animation.liked"]), "discord");

      await dispatchWebhookEvent("animation.liked", { animationId: "abc" }, userId);

      const parsed = JSON.parse(capturedBody!);
      expect(parsed.embeds).toHaveLength(1);
      expect(parsed.embeds[0].title).toBe("animation.liked");
      expect(parsed.embeds[0].color).toBe(0x6366f1);

      vi.restoreAllMocks();
    });

    it("formats generic payload with event and data", async () => {
      let capturedBody: string | undefined;
      vi.spyOn(globalThis, "fetch").mockImplementation(async (_url, init) => {
        capturedBody = (init as RequestInit).body as string;
        return new Response("ok", { status: 200 });
      });

      const id = crypto.randomUUID();
      db.prepare(
        "INSERT INTO webhooks (id, user_id, url, secret, events, format) VALUES (?, ?, ?, ?, ?, ?)"
      ).run(id, userId, "https://generic.com/hook", "sec", JSON.stringify(["animation.updated"]), "generic");

      await dispatchWebhookEvent("animation.updated", { animationId: "xyz" }, userId);

      const parsed = JSON.parse(capturedBody!);
      expect(parsed.event).toBe("animation.updated");
      expect(parsed.data.animationId).toBe("xyz");
      expect(parsed.timestamp).toBeDefined();

      vi.restoreAllMocks();
    });
  });
});
