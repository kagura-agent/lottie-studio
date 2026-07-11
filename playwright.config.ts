import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 2,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? "github" : "html",
  use: {
    baseURL: process.env.BASE_URL || "http://localhost:3001",
    trace: "on-first-retry",
    serviceWorkers: "block",
    ...devices["Desktop Chrome"],
  },
  webServer: {
    command: "npx next dev --port 3001 --turbopack",
    url: "http://localhost:3001",
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
