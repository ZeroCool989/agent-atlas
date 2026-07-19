import { expect, test } from '@playwright/test';

test('sampling lesson: mental model, steppable distribution viz, top-k vs top-p, interview package', async ({
  page,
}) => {
  await page.goto('/concepts/sampling');

  await expect(page.getByRole('heading', { level: 1, name: 'Sampling & Temperature' })).toBeVisible();

  // Mental model with its breaking point.
  await expect(page.getByText(/Mental model: a weighted raffle/)).toBeVisible();
  await expect(page.getByText(/Where the analogy breaks/)).toBeVisible();

  // The Tier-2 steppable distribution visual: server-rendered first frame (step 1, raw distribution).
  const demo = page.locator('section[aria-label="Sampling walkthrough"]');
  await expect(demo.getByRole('heading', { name: /The raw distribution/ })).toBeVisible(); // SSR frame
  const island = page.locator('astro-island', { has: demo });
  await island.scrollIntoViewIfNeeded();
  await expect(island).not.toHaveAttribute('ssr', /.*/); // hydrated

  // Stepping advances through temperature reshape and top-k / top-p truncation.
  const stepper = demo.getByRole('group', { name: 'Sampling steps' });
  const next = stepper.getByRole('button', { name: /next/i });
  await next.click(); // lower temperature
  await expect(demo.getByRole('heading', { name: /Lower temperature/ })).toBeVisible();
  await next.click(); // higher temperature
  await next.click(); // top-k
  await expect(demo.getByRole('heading', { name: /Top-k/ })).toBeVisible();
  await expect(demo.getByText(/can be drawn/)).toBeVisible();

  // Nine-section body + honest determinism nuance.
  await expect(page.getByRole('heading', { name: 'When should I avoid it?' })).toBeVisible();
  await expect(page.getByText(/not bit-identical across hardware/)).toBeVisible();

  // Interview package: the critical-thinking / governance question renders.
  await expect(page.getByText(/when is raising the temperature actively the wrong move/i)).toBeVisible();
});

test('sampling appears on the concepts index as a complete foundation concept', async ({ page }) => {
  await page.goto('/concepts?status=complete');
  await expect(page.getByRole('link', { name: 'Sampling & Temperature' })).toBeVisible();
});
