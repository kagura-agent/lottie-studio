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

const MOCK_CHAT_RESPONSE = JSON.stringify({
  text: "Here's a bouncing circle animation for you!",
  lottie: MOCK_LOTTIE_JSON,
});

/**
 * Intercepts the /api/chat endpoint and returns a canned response
 * that includes Lottie JSON, simulating the LLM agent.
 */
export async function mockLLMRoute(page: Page) {
  await page.route("**/api/chat", async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: MOCK_CHAT_RESPONSE,
    });
  });
}

/**
 * Intercepts WebSocket connections and provides mock streaming responses.
 * Use when testing the real-time preview flow.
 */
export async function mockWebSocket(page: Page) {
  // Intercept fetch-based streaming (SSE/chunked) used by the chat route
  await page.route("**/api/chat", async (route: Route) => {
    const chunks = [
      JSON.stringify({ type: "text", content: "Here's a bouncing circle!" }),
      JSON.stringify({ type: "lottie", content: MOCK_LOTTIE_JSON }),
      JSON.stringify({ type: "done" }),
    ];

    await route.fulfill({
      status: 200,
      contentType: "text/event-stream",
      body: chunks.map((c) => `data: ${c}\n\n`).join(""),
    });
  });
}

/**
 * Mock the animations API to return sample gallery data.
 */
export async function mockGalleryAPI(page: Page) {
  await page.route("**/api/animations?*", async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        animations: [
          {
            id: "test-1",
            name: "Bouncing Ball",
            thumbnail: null,
            createdAt: "2026-01-01T00:00:00Z",
            updatedAt: "2026-01-01T00:00:00Z",
          },
          {
            id: "test-2",
            name: "Spinning Star",
            thumbnail: null,
            createdAt: "2026-01-02T00:00:00Z",
            updatedAt: "2026-01-02T00:00:00Z",
          },
        ],
        total: 2,
      }),
    });
  });
}
