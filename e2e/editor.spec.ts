import { test, expect } from '@playwright/test';
import { mockChatAPI } from './fixtures/mock-api';

test.describe('Editor Page', () => {
  test.beforeEach(async ({ page }) => {
    await mockChatAPI(page);
  });

  test('renders canvas area and chat panel', async ({ page }) => {
    await page.goto('/editor/new');
    // Canvas/preview area should exist
    const canvas = page.locator('[data-testid="canvas"]')
      .or(page.locator('.lottie-canvas'))
      .or(page.locator('[class*="canvas"]'))
      .or(page.locator('[class*="preview"]'));
    await expect(canvas.first()).toBeVisible({ timeout: 10_000 });

    // Chat panel should exist
    const chat = page.locator('[data-testid="chat-panel"]')
      .or(page.locator('[class*="chat"]'))
      .or(page.locator('[role="log"]'));
    await expect(chat.first()).toBeVisible();
  });

  test('chat input accepts text', async ({ page }) => {
    await page.goto('/editor/new');
    const input = page.locator('textarea, input[type="text"]')
      .filter({ hasText: '' })
      .or(page.getByPlaceholder(/describe|message|type|ask/i));
    await expect(input.first()).toBeVisible({ timeout: 10_000 });
    await input.first().fill('make a bouncing red ball');
    await expect(input.first()).toHaveValue('make a bouncing red ball');
  });

  test('submitting message shows it in message list', async ({ page }) => {
    await page.goto('/editor/new');
    const input = page.locator('textarea, input[type="text"]')
      .or(page.getByPlaceholder(/describe|message|type|ask/i));
    await input.first().fill('make a bouncing red ball');
    await input.first().press('Enter');

    // User message should appear in the chat
    const userMessage = page.getByText('make a bouncing red ball');
    await expect(userMessage.first()).toBeVisible({ timeout: 10_000 });
  });
});
