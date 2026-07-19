import { expect, test } from '@playwright/test';

// These run against the built + previewed site (playwright webServer = build && preview),
// so the Pagefind index at /pagefind/ exists and search actually works.

test('sources ledger lists ingested sources with resolving links', async ({ page }) => {
  await page.goto('/sources');
  await expect(page.getByRole('heading', { level: 1, name: 'Sources' })).toBeVisible();
  const items = page.locator('li[data-source]');
  expect(await items.count()).toBeGreaterThan(5);
  // A known source routes to the rag concept; the link resolves to a real page.
  const ragLink = page.locator('li[data-source] a[href="/concepts/rag"]').first();
  await expect(ragLink).toBeVisible();
  await ragLink.click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText(/Retrieval-augmented/i);
});

test('playgrounds index lists simulations linking to their concepts', async ({ page }) => {
  await page.goto('/playgrounds');
  await expect(page.getByRole('heading', { level: 1, name: 'Playgrounds' })).toBeVisible();
  await expect(page.locator('a[data-playground="tokenizer"]')).toHaveAttribute(
    'href',
    '/concepts/tokens',
  );
  await expect(page.locator('a[data-playground="rag-pipeline"]')).toHaveAttribute(
    'href',
    '/concepts/rag',
  );
  // The index itself ships no client JS.
  const scripts: string[] = [];
  page.on('request', (r) => {
    if (r.resourceType() === 'script') scripts.push(r.url());
  });
  await page.goto('/playgrounds');
  expect(scripts).toEqual([]);
});

test('search finds a concept by term against the built index', async ({ page }) => {
  await page.goto('/search');
  await expect(page.getByRole('heading', { level: 1, name: 'Search' })).toBeVisible();
  const input = page.getByPlaceholder(/Search concepts/);
  await input.fill('embeddings');
  // Pagefind loads its index lazily; wait for a result linking to the embeddings concept.
  const result = page.locator('a[href*="/concepts/embeddings"]').first();
  await expect(result).toBeVisible({ timeout: 15_000 });
});
