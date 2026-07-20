import { expect, test, type Locator } from '@playwright/test';

/**
 * Advance a Stepper by clicking Next until `target` is visible, bounded by `maxSteps`
 * (no hard-coded step indices — the lesson can add/reorder beats without breaking this).
 */
async function stepUntilVisible(next: Locator, target: Locator, maxSteps = 10): Promise<void> {
  for (let i = 0; i < maxSteps; i++) {
    if (await target.isVisible()) return;
    if (!(await next.isEnabled())) break;
    await next.click();
  }
  await expect(target).toBeVisible();
}

test('cost-engineering lesson: mental model, steppable lever walkthrough, honest limit, governance, interview', async ({
  page,
}) => {
  await page.goto('/concepts/cost-engineering');

  await expect(page.getByRole('heading', { level: 1, name: 'Cost engineering' })).toBeVisible();

  // Mental model with its breaking point.
  await expect(page.getByText(/Mental model: a metered utility bill/)).toBeVisible();
  await expect(page.getByText(/Where the analogy breaks/)).toBeVisible();

  // Tier-2 viz: server-rendered first frame (step 0, the unoptimized baseline).
  const demo = page.locator('section[aria-label="Cost-engineering lever walkthrough"]');
  await expect(demo.getByRole('heading', { name: /Baseline/ })).toBeVisible();

  // Wait for the client:visible island to hydrate before interacting (avoids a click-race).
  const island = page.locator('astro-island', { has: demo });
  await island.scrollIntoViewIfNeeded();
  await expect(island).not.toHaveAttribute('ssr', /.*/);

  const stepper = demo.getByRole('group', { name: 'Cost-engineering steps' });
  const next = stepper.getByRole('button', { name: /next/i });
  await expect(next).toBeEnabled();

  // Right-sizing the model is the first and biggest lever.
  await stepUntilVisible(next, demo.getByRole('heading', { name: /Right-size the model/i }));

  // Capping the loop is the final lever, and the running cost has dropped well below baseline.
  await stepUntilVisible(next, demo.getByRole('heading', { name: /Cap loop iterations/i }));
  await expect(demo.getByText(/Saved vs baseline/i)).toBeVisible();

  // Nine-section body + the crisp caching distinction.
  await expect(page.getByRole('heading', { name: 'When should I avoid it?' })).toBeVisible();
  await expect(
    page.getByRole('heading', { name: /Prompt caching vs response caching/i }),
  ).toBeVisible();

  // Governance: cost control as an operational obligation, plus the denial-of-wallet abuse angle.
  await expect(page.getByText(/operational obligation/i).first()).toBeVisible();
  await expect(page.getByText(/denial of wallet/i).first()).toBeVisible();

  // Interview package: the critical-thinking "bill tripled" question renders.
  await expect(page.getByText(/bill tripled/i).first()).toBeVisible();
});

test('cost-engineering appears on the concepts index as a complete useful-addition concept', async ({
  page,
}) => {
  await page.goto('/concepts?status=complete');
  await expect(page.getByRole('link', { name: 'Cost engineering' })).toBeVisible();
});
