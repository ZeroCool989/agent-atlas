import { expect, test } from '@playwright/test';

test('experiments index lists checked-in results, ships zero JS', async ({ page }) => {
  const scripts: string[] = [];
  page.on('request', (req) => {
    if (req.resourceType() === 'script') scripts.push(req.url());
  });
  await page.goto('/experiments');
  await expect(page.getByRole('heading', { name: 'AI Engineering Laboratory' })).toBeVisible();
  await expect(page.getByRole('link', { name: /004-failure-modes/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /001-tool-use-baseline/ })).toBeVisible();
  expect(scripts).toEqual([]); // index is a content page
});

test('experiment page: interactive trace viewer over recorded runs', async ({ page }) => {
  await page.goto('/experiments/004-failure-modes');
  await expect(page.getByRole('heading', { name: /004-failure-modes/ })).toBeVisible();
  await expect(page.getByText(/Expected observation \(pre-registered\)/)).toBeVisible();

  const viewer = page.locator('section[aria-label="Experiment trace viewer"]');
  await expect(viewer.getByRole('heading', { name: 'Run started' })).toBeVisible(); // SSR frame

  const island = page.locator('astro-island', { has: viewer });
  await island.scrollIntoViewIfNeeded();
  await expect(island).not.toHaveAttribute('ssr', /.*/);

  // First run is the unknown-tool rejection (outcome shown in the metrics grid).
  await expect(viewer.getByRole('definition').filter({ hasText: 'invalid-tool-request' }).first()).toBeVisible();
  const toolbar = viewer.locator('[role="group"]');
  await toolbar.getByRole('button', { name: 'Next' }).click();
  await toolbar.getByRole('button', { name: 'Next' }).click();
  await expect(viewer.getByText(/Runtime REJECTED tool request|allowlist/).first()).toBeVisible();

  // Switch to the tool-exception run.
  await viewer.getByRole('combobox').selectOption({ index: 2 }); // tool-exception run
  await expect(viewer.getByRole('definition').filter({ hasText: 'tool-error' }).first()).toBeVisible();
});
