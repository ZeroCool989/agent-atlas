import { expect, test } from '@playwright/test';

test('evaluation lesson: mental model, steppable eval run catches valid-but-wrong, governance, interview', async ({
  page,
}) => {
  await page.goto('/concepts/evaluation');

  await expect(page.getByRole('heading', { level: 1, name: 'Evaluation' })).toBeVisible();

  // Mental model with its breaking point.
  await expect(page.getByText(/a test suite whose subject lies sometimes/)).toBeVisible();
  await expect(page.getByText(/Where the analogy breaks/)).toBeVisible();

  // Tier-2 viz server frame (step 0, nothing scored yet).
  const demo = page.locator('section[aria-label="Evaluation run walkthrough"]');
  await expect(demo.getByRole('heading', { name: /The eval set/ })).toBeVisible();

  // The steppable island hydrates before we interact (clicking pre-hydration is a race).
  const stepper = demo.getByRole('group', { name: 'Evaluation steps' });
  await stepper.scrollIntoViewIfNeeded();
  const island = page.locator('astro-island', { has: stepper });
  await expect(island).not.toHaveAttribute('ssr', /.*/);

  const next = stepper.getByRole('button', { name: /next/i });
  await expect(next).toBeEnabled();
  // Advance to the third case: valid JSON, right key, wrong value — the case an eval
  // catches that a schema validator would pass.
  await next.click();
  await next.click();
  await next.click();
  await expect(demo.getByText(/wrong-value/).first()).toBeVisible();

  // Governance: evals as the evidence behind trust claims.
  await expect(page.getByText(/Evals are the evidence behind trust claims/)).toBeVisible();

  // Interview package: the critical-thinking / overfitting question renders.
  await expect(page.getByText(/overfit the eval/).first()).toBeVisible();
});

test('evaluation appears on the concepts index as a complete core-mechanism concept', async ({
  page,
}) => {
  await page.goto('/concepts?status=complete');
  await expect(page.getByRole('link', { name: 'Evaluation' })).toBeVisible();
});
