import { expect, test } from '@playwright/test';

test('home page renders', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'Agent Atlas' })).toBeVisible();
});

test('plain content page ships zero client JS', async ({ page }) => {
  // The home is now the interactive Atlas graph (the signature surface) and legitimately
  // hydrates an island. The zero-JS invariant is enforced here on an actual plain content
  // page — a complete concept whose visualization is static/server-rendered.
  const scriptRequests: string[] = [];
  page.on('request', (req) => {
    if (req.resourceType() === 'script') scriptRequests.push(req.url());
  });
  await page.goto('/concepts/context-windows');
  expect(scriptRequests).toEqual([]);
  expect(await page.locator('script').count()).toBe(0);
});
