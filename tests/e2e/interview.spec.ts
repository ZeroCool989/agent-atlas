import { expect, test } from '@playwright/test';

const ISLAND = (page: import('@playwright/test').Page) =>
  page.locator('astro-island', { has: page.getByRole('list', { name: 'Interview questions' }) });

test('interview prep lists questions and answers WITHOUT JavaScript (static-first)', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto('/interview');
  await expect(page.getByRole('heading', { level: 1, name: 'Interview prep' })).toBeVisible();
  // The drill island is server-rendered, so the full question list is present with no JS.
  await expect(page.getByRole('list', { name: 'Interview questions' })).toBeVisible();
  await expect(page.locator('li[data-question]').first()).toBeVisible();
  // A tiered answer is reachable via native <details> without JS.
  const firstDetails = page.locator('li[data-question]').first().locator('details').first();
  await firstDetails.locator('summary').click();
  await expect(firstDetails.locator('p')).toBeVisible();
  await context.close();
});

test('role filter narrows the list client-side from the URL', async ({ page }) => {
  await page.goto('/interview?role=product');
  const island = ISLAND(page);
  await island.scrollIntoViewIfNeeded();
  await expect(island).not.toHaveAttribute('ssr', /.*/); // hydrated → filter applied
  // A product-role question is shown; a non-product (engineer/architect) one is filtered out.
  await expect(page.getByText(/Explain temperature to a non-technical product owner/)).toBeVisible();
  await expect(page.getByText(/The model returns JSON that parses fine/)).toHaveCount(0);
});

test('drill island hydrates and self-grades persist across reload', async ({ page }) => {
  await page.goto('/interview');
  const island = ISLAND(page);
  await island.scrollIntoViewIfNeeded();
  await expect(island).not.toHaveAttribute('ssr', /.*/);
  const firstCard = page.locator('li[data-question]').first();
  const qid = await firstCard.getAttribute('data-question');
  await firstCard.getByRole('button', { name: 'Good' }).click(); // waits for enablement (loaded)
  await expect(firstCard.getByRole('button', { name: 'Good' })).toHaveAttribute('aria-pressed', 'true');
  await expect(firstCard.locator(`[data-graded="${qid}"]`)).toContainText('graded good');
  // Wait for the IndexedDB write to complete (durable) before reloading.
  await expect(page.getByRole('list', { name: 'Interview questions' })).toHaveAttribute('data-saved', /[1-9]/);
  // Persists across reload (IndexedDB).
  await page.reload();
  const island2 = ISLAND(page);
  await island2.scrollIntoViewIfNeeded();
  await expect(island2).not.toHaveAttribute('ssr', /.*/);
  await expect(page.locator(`li[data-question="${qid}"]`).getByRole('button', { name: 'Good' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
});

test('role-track page renders its filtered questions', async ({ page }) => {
  await page.goto('/interview/engineer');
  await expect(page.getByRole('heading', { level: 1, name: /engineer track/i })).toBeVisible();
  await expect(page.locator('li[data-question]').first()).toBeVisible();
});
