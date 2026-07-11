import type { Page, Route } from "@playwright/test";

/**
 * Minimal valid Lottie JSON for testing canvas rendering.
 */
export const MOCK_LOTTIE_JSON = {
  v: "5.7.4",
  fr: 30,
  ip: 0,
  op: 60,
  w: 512,
  h: 512,
  nm: "Test Animation",
  ddd: 0,
  assets: [],
  layers: [
    {
      ddd: 0,
      ind: 1,
      ty: 4,
      nm: "Circle",
      sr: 1,
      ks: {
        o: { a: 0, k: 100 },
        r: { a: 0, k: 0 },
        p: { a: 0, k: [256, 256, 0] },
        a: { a: 0, k: [0, 0, 0] },
        s: { a: 0, k: [100, 100, 100] },
      },
      ao: 0,
      shapes: [
        {
          ty: "el",
          d: 1,
          s: { a: 0, k: [200, 200] },
          p: { a: 0, k: [0, 0] },
          nm: "Ellipse",
        },
        {
          ty: "fl",
          c: { a: 0, k: [0.2, 0.5, 1, 1] },
          o: { a: 0, k: 100 },
          r: 1,
          nm: "Fill",
        },
      ],
      ip: 0,
      op: 60,
      st: 0,
    },
  ],
};

/**
 * Mock the /api/chat endpoint to return a non-streaming JSON response
 * that the ChatPanel can handle via the fallback (non-SSE) path.
 */
export async function mockLLMRoute(page: Page) {
  await page.route("**/api/chat", async (route: Route) => {
    const method = route.request().method();
    if (method !== "POST") {
      await route.fallback();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        reply: "Here's a bouncing circle animation for you!",
        animationId: "test-animation-id",
        lottieJson: MOCK_LOTTIE_JSON,
      }),
    });
  });

  // Dismiss onboarding tour to prevent it from blocking interactions
  await page.addInitScript(() => {
    localStorage.setItem("lottie-studio-onboarding-done", "true");
  });
}

/**
 * Mock the animations API to return sample gallery data.
 */
export async function mockGalleryAPI(page: Page) {
  const animations = [
    {
      id: "test-1",
      name: "Bouncing Ball",
      frame_count: 60,
      duration_seconds: 2,
      created_at: "2026-01-01T00:00:00Z",
    },
    {
      id: "test-2",
      name: "Spinning Star",
      frame_count: 60,
      duration_seconds: 2,
      created_at: "2026-01-02T00:00:00Z",
    },
  ];

  await page.route("**/api/animations", async (route: Route) => {
    if (route.request().method() !== "GET") {
      await route.fallback();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(animations),
    });
  });

  await page.route("**/templates/index.json", async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([]),
    });
  });

  await page.route("**/api/auth/me", async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ user: null }),
    });
  });

  await page.route("**/api/collections**", async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([]),
    });
  });
}
