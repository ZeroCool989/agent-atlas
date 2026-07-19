import { expect, test } from '@playwright/test';

test('what-is-a-language-model lesson: mental model, autoregressive generation viz hydrates, governance, interview', async ({
  page,
}) => {
  await page.goto('/concepts/what-is-a-language-model');

  await expect(
    page.getByRole('heading', { level: 1, name: 'What a Language Model Is' }),
  ).toBeVisible();

  // Mental model with its breaking point (honest-analogy rule).
  await expect(page.getByText(/Mental model: an autocomplete/)).toBeVisible();
  await expect(page.getByText(/Where the analogy breaks/)).toBeVisible();

  // The Tier-2 generation visual renders its server frame (step 1, the prompt).
  const demo = page.locator('section[aria-label="Generation walkthrough"]');
  await expect(demo.getByRole('heading', { name: /The prompt/ })).toBeVisible(); // SSR frame

  // Wait for the client:visible island to hydrate before interacting (Astro drops the
  // `ssr` attribute from <astro-island> once hydrated) — clicking before hydration is a race.
  const island = page.locator('astro-island', { has: demo });
  await island.scrollIntoViewIfNeeded();
  await expect(island).not.toHaveAttribute('ssr', /.*/);

  // Stepping advances into the autoregressive loop: a real next-token distribution appears.
  const stepper = demo.getByRole('group', { name: 'Generation steps' });
  const next = stepper.getByRole('button', { name: /next/i });
  await expect(next).toBeEnabled();
  await next.click();
  await expect(demo.getByRole('heading', { name: /Predict token 1/ })).toBeVisible();
  await expect(demo.getByLabel('Next-token distribution')).toBeVisible();

  // Nine-section body + the honest frozen-weights point.
  await expect(page.getByRole('heading', { name: 'When should I avoid it?' })).toBeVisible();
  await expect(page.getByText(/weights are frozen/i).first()).toBeVisible();

  // Governance section links the EU AI Act framework.
  await expect(page.locator('section[aria-label="Governance connections"]')).toContainText(
    /AI Act/,
  );

  // Interview package: the critical-thinking question renders.
  await expect(page.getByText(/why does it appear to reason/i)).toBeVisible();
});

test('what-is-a-language-model appears on the concepts index as a complete foundation concept', async ({
  page,
}) => {
  await page.goto('/concepts?status=complete');
  await expect(page.getByRole('link', { name: 'What a Language Model Is' })).toBeVisible();
});
