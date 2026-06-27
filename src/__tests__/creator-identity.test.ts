import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();

// Mock crypto.randomUUID
const mockUUID = "test-uuid-1234-5678-abcd-ef0123456789";

beforeEach(() => {
  localStorageMock.clear();
  vi.stubGlobal("localStorage", localStorageMock);
  vi.stubGlobal("crypto", { randomUUID: () => mockUUID });
});

describe("creatorId", () => {
  it("generates a new creator ID on first call", async () => {
    const { getCreatorId } = await import("@/lib/creatorId");
    const id = getCreatorId();
    expect(id).toBe(mockUUID);
    expect(localStorageMock.getItem("lottie-studio-creator-id")).toBe(mockUUID);
  });

  it("returns existing creator ID on subsequent calls", async () => {
    localStorageMock.setItem("lottie-studio-creator-id", "existing-id-123");
    // Re-import to get fresh module
    vi.resetModules();
    const { getCreatorId } = await import("@/lib/creatorId");
    const id = getCreatorId();
    expect(id).toBe("existing-id-123");
  });

  it("getCreatorName returns null when not set", async () => {
    const { getCreatorName } = await import("@/lib/creatorId");
    expect(getCreatorName()).toBeNull();
  });

  it("setCreatorName stores and getCreatorName retrieves", async () => {
    const { setCreatorName, getCreatorName } = await import("@/lib/creatorId");
    setCreatorName("Alice");
    expect(getCreatorName()).toBe("Alice");
    expect(localStorageMock.getItem("lottie-studio-creator-name")).toBe("Alice");
  });
});

describe("apiFetch", () => {
  beforeEach(() => {
    localStorageMock.setItem("lottie-studio-creator-id", "test-creator-id");
    vi.resetModules();
  });

  it("adds X-Creator-Id header to requests", async () => {
    const mockFetch = vi.fn().mockResolvedValue(new Response("ok"));
    vi.stubGlobal("fetch", mockFetch);

    const { apiFetch } = await import("@/lib/apiFetch");
    await apiFetch("/api/test", { method: "POST" });

    expect(mockFetch).toHaveBeenCalledOnce();
    const [, init] = mockFetch.mock.calls[0];
    const headers = new Headers(init.headers);
    expect(headers.get("X-Creator-Id")).toBe("test-creator-id");
  });

  it("adds X-Creator-Name header when name is set", async () => {
    localStorageMock.setItem("lottie-studio-creator-name", "Bob");
    const mockFetch = vi.fn().mockResolvedValue(new Response("ok"));
    vi.stubGlobal("fetch", mockFetch);

    const { apiFetch } = await import("@/lib/apiFetch");
    await apiFetch("/api/test");

    const [, init] = mockFetch.mock.calls[0];
    const headers = new Headers(init.headers);
    expect(headers.get("X-Creator-Id")).toBe("test-creator-id");
    expect(headers.get("X-Creator-Name")).toBe("Bob");
  });

  it("preserves existing headers", async () => {
    const mockFetch = vi.fn().mockResolvedValue(new Response("ok"));
    vi.stubGlobal("fetch", mockFetch);

    const { apiFetch } = await import("@/lib/apiFetch");
    await apiFetch("/api/test", {
      headers: { "Content-Type": "application/json" },
    });

    const [, init] = mockFetch.mock.calls[0];
    const headers = new Headers(init.headers);
    expect(headers.get("Content-Type")).toBe("application/json");
    expect(headers.get("X-Creator-Id")).toBe("test-creator-id");
  });
});
