import { expect, test } from '@playwright/test';

test('reliability-patterns lesson: mental model, steppable stack viz hydrates, governance, interview', async ({
  page,
}) => {
  await page.goto('/concepts/reliability-patterns');

  // Mental model with its breaking point.
  await expect(page.getByText(/Mental model: an experienced traveller with a backup plan/)).toBeVisible();
  await expect(page.getByText(/Where the analogy breaks/)).toBeVisible();

  // The Tier-2 viz renders its server frame: scenario 1 (retry), first attempt, at t = 0ms.
  await expect(page.getByText(/Reliability stack ·/).first()).toBeVisible();
  await expect(page.getByRole('heading', { name: 'First attempt' })).toBeVisible();

  // The steppable island hydrates before we interact (Astro drops the `ssr` attribute from
  // <astro-island> once hydrated) — clicking before hydration is a race.
  const stepper = page.getByRole('group', { name: 'Reliability stack steps' });
  await stepper.scrollIntoViewIfNeeded();
  const island = page.locator('astro-island', { has: stepper });
  await expect(island).not.toHaveAttribute('ssr', /.*/);

  const next = stepper.getByRole('button', { name: 'Next' });

  // Step forward until the circuit breaker opens — bounded loop, no hard-coded index, robust to the
  // exact number of frames in the trace.
  const breakerOpens = page.getByText(/stop hammering the dependency/);
  for (let i = 0; i < 40 && !(await breakerOpens.isVisible()); i += 1) {
    await expect(next).toBeEnabled();
    await next.click();
  }
  await expect(breakerOpens).toBeVisible();

  // Keep stepping until the breaker recovers (closes) — the full closed→open→half-open→closed
  // lifecycle played out. Bounded loop, no hard-coded index.
  const recovered = page.getByText(/dependency healthy again/);
  for (let i = 0; i < 20 && !(await recovered.isVisible()); i += 1) {
    await expect(next).toBeEnabled();
    await next.click();
  }
  await expect(recovered).toBeVisible();

  // Governance section makes the silent-degradation point.
  await expect(page.getByText(/availability is not correctness/).first()).toBeVisible();

  // Interview package renders the critical-thinking question.
  await expect(
    page.getByText(/Retries improved your success rate. When is that hiding a problem/),
  ).toBeVisible();
});

test('reliability-patterns appears on the concepts index as a complete useful-addition concept', async ({
  page,
}) => {
  await page.goto('/concepts?status=complete');
  await expect(page.getByRole('link', { name: 'Reliability Patterns' })).toBeVisible();
});
