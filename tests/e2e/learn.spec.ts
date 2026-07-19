import { expect, test } from '@playwright/test';

test('The Path renders the ordered curriculum without JavaScript', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto('/learn');
  await expect(page.getByRole('heading', { level: 1, name: 'The Path' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 2, name: /foundation/i })).toBeVisible();
  // The ordered list is server-rendered and usable with no JS.
  expect(await page.locator('[data-concept-item]').count()).toBeGreaterThan(5);
  await expect(page.locator('[data-concept-item][data-slug="tokens"]')).toBeVisible();
  await context.close();
});

test('a layer page lists its lessons with prev/next navigation', async ({ page }) => {
  await page.goto('/learn/core-mechanism');
  await expect(page.getByRole('heading', { level: 1, name: /core mechanism/i })).toBeVisible();
  await expect(page.getByRole('link', { name: 'RAG' })).toBeVisible();
  const nav = page.getByRole('navigation', { name: 'Curriculum layers' });
  await expect(nav.getByRole('link', { name: /foundation/i })).toBeVisible();
});

test('mark-as-read persists locally and the Path reflects it after navigation', async ({ page }) => {
  await page.goto('/concepts/tokens');
  const btn = page.getByRole('button', { name: /mark as read/i });
  await expect(btn).toBeEnabled(); // island hydrated (control enables after mount)
  await btn.click();
  await expect(page.getByRole('button', { name: /marked done/i })).toBeVisible();

  await page.goto('/learn');
  await expect(page.getByText(/1 of \d+ concepts marked read/)).toBeVisible();
  await expect(page.locator('[data-concept-item][data-slug="tokens"]')).toContainText('read');
});
