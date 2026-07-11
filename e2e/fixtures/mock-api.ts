/**
 * Shared mock Lottie response for deterministic E2E tests.
 * Intercepts /api/chat calls and returns a simple bouncing circle animation.
 */
import { Page } from '@playwright/test';

const MOCK_LOTTIE_JSON = {
  v: '5.7.4',
  fr: 30,
  ip: 0,
  op: 60,
  w: 400,
  h: 400,
  nm: 'Bouncing Circle',
  layers: [
    {
      ty: 4,
      nm: 'Circle',
      ip: 0,
      op: 60,
      ks: {
        p: { a: 1, k: [
          { t: 0, s: [200, 100], e: [200, 300], i: { x: [0.5], y: [1] }, o: { x: [0.5], y: [0] } },
          { t: 30, s: [200, 300], e: [200, 100], i: { x: [0.5], y: [1] }, o: { x: [0.5], y: [0] } },
          { t: 60, s: [200, 100] },
        ]},
        s: { a: 0, k: [100, 100] },
        o: { a: 0, k: 100 },
      },
      shapes: [
        {
          ty: 'el',
          p: { a: 0, k: [0, 0] },
          s: { a: 0, k: [80, 80] },
        },
        {
          ty: 'fl',
          c: { a: 0, k: [1, 0.4, 0.4, 1] },
          o: { a: 0, k: 100 },
        },
      ],
    },
  ],
};

/**
 * Mock the /api/chat endpoint to return a deterministic Lottie response.
 */
export async function mockChatAPI(page: Page) {
  await page.route('**/api/chat**', async (route) => {
    const reply = `I created a bouncing red circle animation for you! It bounces up and down smoothly over 2 seconds.`;
    const responseBody = JSON.stringify({
      type: 'done',
      reply,
      lottieJson: MOCK_LOTTIE_JSON,
      animationId: 'test-animation-001',
      suggestions: ['Make it blue', 'Add a shadow', 'Make it faster'],
    });

    // Return as SSE stream format
    const sseData = `data: ${JSON.stringify({ type: 'chunk', text: reply })}\n\ndata: ${responseBody}\n\n`;

    await route.fulfill({
      status: 200,
      contentType: 'text/event-stream',
      body: sseData,
    });
  });
}

/**
 * Mock animations API to return a list of saved animations.
 */
export async function mockAnimationsAPI(page: Page) {
  await page.route('**/api/animations**', async (route, request) => {
    if (request.method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'demo-1',
            name: 'Bouncing Ball',
            thumbnail: null,
            createdAt: '2026-07-01T00:00:00Z',
            updatedAt: '2026-07-01T00:00:00Z',
          },
          {
            id: 'demo-2',
            name: 'Spinning Star',
            thumbnail: null,
            createdAt: '2026-07-02T00:00:00Z',
            updatedAt: '2026-07-02T00:00:00Z',
          },
        ]),
      });
    } else {
      await route.continue();
    }
  });
}

export { MOCK_LOTTIE_JSON };
