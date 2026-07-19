import { expect, test } from '@playwright/test';

test('vector-search lesson: mental model, flat-vs-approximate viz hydrates and shows the recall miss, governance, interview', async ({
  page,
}) => {
  await page.goto('/concepts/vector-search');

  await expect(page.getByRole('heading', { level: 1, name: 'Vector search' })).toBeVisible();

  // Mental model with its breaking point.
  await expect(page.getByText(/Mental model: a library catalogue/)).toBeVisible();
  await expect(page.getByText(/Where the analogy breaks/)).toBeVisible();

  // Tier-2 viz server frame: the setup step title renders without JS.
  await expect(page.getByText('A query against a corpus')).toBeVisible();

  // Wait for the client:visible island to hydrate before interacting (Astro drops the
  // `ssr` attribute from <astro-island> once hydrated) — clicking before hydration is a race.
  const stepper = page.getByRole('group', { name: 'Flat versus approximate vector search' });
  await stepper.scrollIntoViewIfNeeded();
  const island = page.locator('astro-island', { has: stepper });
  await expect(island).not.toHaveAttribute('ssr', /.*/);
  const next = stepper.getByRole('button', { name: 'Next' });
  await expect(next).toBeEnabled();

  // Step 1 — flat search is exact and scans everything.
  await next.click();
  await expect(page.getByText(/16 comparisons, recall 1\.0/).first()).toBeVisible();

  // Step 2 — probing one cluster is cheaper but misses a true neighbor (recall drops).
  await next.click();
  await expect(page.getByText(/motorbike — missed/).first()).toBeVisible();

  // Governance: deletion must reach the vector index.
  await expect(page.getByText(/Deletion has to reach the index/)).toBeVisible();

  // Interview package: the critical-thinking question renders.
  await expect(page.getByText(/they don.t need one/)).toBeVisible();
});

test('vector-search appears on the concepts index as a complete core-mechanism concept', async ({
  page,
}) => {
  await page.goto('/concepts?status=complete');
  await expect(page.getByRole('link', { name: 'Vector search' })).toBeVisible();
});
