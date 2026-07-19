import { expect, test, type Locator } from '@playwright/test';

/**
 * Advance a Stepper by clicking Next until `target` is visible, bounded by `maxSteps`
 * (no hard-coded step indices — the lesson can add/reorder beats without breaking this).
 */
async function stepUntilVisible(next: Locator, target: Locator, maxSteps = 12): Promise<void> {
  for (let i = 0; i < maxSteps; i++) {
    if (await target.isVisible()) return;
    if (!(await next.isEnabled())) break;
    await next.click();
  }
  await expect(target).toBeVisible();
}

test('observability lesson: mental model, steppable span-tree trace, honest limit, governance, interview', async ({
  page,
}) => {
  await page.goto('/concepts/observability');

  await expect(page.getByRole('heading', { level: 1, name: 'Observability' })).toBeVisible();

  // Mental model with its breaking point.
  await expect(page.getByText(/Mental model: a flight recorder/)).toBeVisible();
  await expect(page.getByText(/Where the analogy breaks/)).toBeVisible();

  // Tier-2 viz: server-rendered first frame (step 0, root span open, nothing measured).
  const demo = page.locator('section[aria-label="Observability trace walkthrough"]');
  await expect(demo.getByRole('heading', { name: /A request arrives/ })).toBeVisible();

  // Wait for the client:visible island to hydrate before interacting (avoids a click-race).
  const island = page.locator('astro-island', { has: demo });
  await island.scrollIntoViewIfNeeded();
  await expect(island).not.toHaveAttribute('ssr', /.*/);

  const stepper = demo.getByRole('group', { name: 'Observability steps' });
  const next = stepper.getByRole('button', { name: /next/i });
  await expect(next).toBeEnabled();

  // The slow tool call times out — the span carrying both the latency and the failure.
  await stepUntilVisible(next, demo.getByText(/timed out/i).first());

  // The metrics resolve and name the slow, errored span as the bottleneck.
  await stepUntilVisible(next, demo.getByRole('heading', { name: /Roll it up: the metrics/i }));
  await expect(demo.getByText(/Slowest span by self-time/i).last()).toBeVisible();

  // Nine-section body + the crisp three-way distinction.
  await expect(page.getByRole('heading', { name: 'When should I avoid it?' })).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Observability vs evaluation vs verification' }),
  ).toBeVisible();

  // Governance: traces/logs as audit trail, with the PII-in-logs liability.
  await expect(page.getByText(/Traces and logs are the audit trail/i)).toBeVisible();
  await expect(page.getByText(/data-protection liability/i)).toBeVisible();

  // Interview package: the critical-thinking "sometimes wrong in production" question renders.
  await expect(page.getByText(/sometimes wrong.*in production/i).first()).toBeVisible();
});

test('observability appears on the concepts index as a complete useful-addition concept', async ({
  page,
}) => {
  await page.goto('/concepts?status=complete');
  await expect(page.getByRole('link', { name: 'Observability' })).toBeVisible();
});
