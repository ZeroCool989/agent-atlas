import { expect, test } from '@playwright/test';

test('first frame is meaningful WITHOUT JavaScript (static-first)', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto('/viz-demo');
  await expect(page.getByRole('heading', { name: 'Visual foundation demo' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '1. Raw text' })).toBeVisible();
  await expect(page.getByText("Tokenization isn't lossless.")).toBeVisible();
  await expect(page.getByText('Step 1 of 5', { exact: true })).toBeVisible();
  // Chromium's CDP script-disable doesn't render <noscript> content; assert it is served.
  expect(await page.content()).toContain('JavaScript is disabled');
  await context.close();
});

test('controls work after hydration: buttons and keyboard stepping', async ({ page }) => {
  await page.goto('/viz-demo');
  const next = page.getByRole('button', { name: 'Next' });
  await expect(next).toBeEnabled(); // hydrated
  await next.click();
  await expect(page.getByRole('heading', { name: '2. Token boundaries' })).toBeVisible();
  await expect(page.getByRole('list', { name: 'Tokens, in order' })).toBeVisible();

  await page.getByRole('button', { name: 'Previous' }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('heading', { name: '3. Token ids' })).toBeVisible();
  await page.keyboard.press('End');
  await expect(page.getByRole('heading', { name: '5. Capacity used' })).toBeVisible();
  await expect(page.getByText('7 of 16 tokens used (43.8%)')).toBeVisible();
  await page.keyboard.press('Home');
  await expect(page.getByRole('heading', { name: '1. Raw text' })).toBeVisible();
});

test('only the visualization page loads island JavaScript', async ({ page }) => {
  const vizScripts: string[] = [];
  page.on('request', (req) => {
    if (req.resourceType() === 'script') vizScripts.push(req.url());
  });
  await page.goto('/viz-demo');
  await page.getByRole('button', { name: 'Next' }).click(); // proves hydration happened
  expect(vizScripts.length).toBeGreaterThan(0);
  // A plain content page (no island) still ships zero JS. The home is now the interactive
  // Atlas graph and legitimately hydrates — so the invariant is checked on a content page.
  const plainScripts: string[] = [];
  page.on('request', (req) => {
    if (req.resourceType() === 'script') plainScripts.push(req.url());
  });
  await page.goto('/governance/gdpr');
  expect(plainScripts).toEqual([]);
});
