import { expect, test } from '@playwright/test';

test('atlas home renders the concept graph server-side, without JavaScript', async ({
  browser,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto('/');
  // The graph and its nodes are in the HTML with no JS (positions are build-time).
  await expect(page.getByRole('heading', { level: 1, name: 'Agent Atlas' })).toBeVisible();
  await expect(page.locator('svg a[data-slug]').first()).toBeVisible();
  // Foundational concepts are on the map and link to their lessons.
  const tokens = page.locator('svg a[data-slug="tokens"]');
  await expect(tokens).toHaveAttribute('href', '/concepts/tokens');
  await context.close();
});

test('atlas graph hydrates and reflects local progress', async ({ page }) => {
  // Seed a "read" state before the island hydrates.
  await page.addInitScript(() => {
    window.localStorage.setItem(
      'agent-atlas:progress:v1',
      JSON.stringify({ version: 1, concepts: { embeddings: 'read' }, updatedAt: 't' }),
    );
  });
  await page.goto('/');

  const island = page.locator('astro-island', { has: page.locator('svg a[data-slug]') });
  await expect(island).not.toHaveAttribute('ssr', /.*/); // hydrated

  // The seeded concept is marked read once the island reads localStorage.
  await expect(page.locator('svg a[data-slug="embeddings"]')).toHaveAttribute(
    'data-progress',
    'read',
  );
  // An unseeded concept is not marked read.
  await expect(page.locator('svg a[data-slug="tokens"]')).not.toHaveAttribute(
    'data-progress',
    'read',
  );

  // Focusing a node surfaces its one-liner in the live detail region.
  await page.locator('svg a[data-slug="tokens"]').focus();
  await expect(page.getByText(/Hover or focus a concept/)).toHaveCount(0);
});
