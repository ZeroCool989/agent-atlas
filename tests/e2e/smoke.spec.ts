import { expect, test } from '@playwright/test';

test('home page renders', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'Agent Atlas' })).toBeVisible();
});

test('plain content page ships zero client JS', async ({ page }) => {
  const scriptRequests: string[] = [];
  page.on('request', (req) => {
    if (req.resourceType() === 'script') scriptRequests.push(req.url());
  });
  await page.goto('/');
  expect(scriptRequests).toEqual([]);
  expect(await page.locator('script').count()).toBe(0);
});
