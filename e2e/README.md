# E2E Tests

End-to-end tests using [Playwright](https://playwright.dev/).

## Setup

```bash
npx playwright install --with-deps chromium
```

## Running

```bash
# Run all E2E tests (starts dev server automatically)
npm run test:e2e

# Run with UI mode for debugging
npx playwright test --ui

# Run a specific test file
npx playwright test e2e/gallery.spec.ts

# Run only desktop tests
npx playwright test --project=chromium

# Run only mobile tests
npx playwright test --project=mobile
```

## Architecture

- **`mock-llm.ts`** — Route interceptors that mock the `/api/chat` endpoint and gallery API, returning canned Lottie JSON so tests are deterministic and require no API keys.
- **Test files** — Each covers a core user journey: gallery browsing, editor creation, chat interaction, canvas rendering, export, mobile layout, and command palette.

## CI

Tests run headless in CI with `npx playwright test`. The `webServer` config in `playwright.config.ts` starts the dev server automatically. No external dependencies (API keys, databases with data) are required since all network calls are mocked at the route level.
