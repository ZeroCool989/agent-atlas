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

test('verification lesson: mental model, steppable four-gate pipeline, honest limit, governance, interview', async ({
  page,
}) => {
  await page.goto('/concepts/verification');

  await expect(
    page.getByRole('heading', { level: 1, name: 'Verification (guardrails & checks)' }),
  ).toBeVisible();

  // Mental model with its breaking point.
  await expect(page.getByText(/Mental model: an independent inspector/)).toBeVisible();
  await expect(page.getByText(/Where the analogy breaks/)).toBeVisible();

  // Tier-2 viz: server-rendered first frame (step 0, nothing run yet).
  const demo = page.locator('section[aria-label="Verification pipeline walkthrough"]');
  await expect(
    demo.getByRole('heading', { name: /A verification pipeline: four independent gates/ }),
  ).toBeVisible();

  // Wait for the client:visible island to hydrate before interacting (avoids a click-race).
  const island = page.locator('astro-island', { has: demo });
  await island.scrollIntoViewIfNeeded();
  await expect(island).not.toHaveAttribute('ssr', /.*/);

  const stepper = demo.getByRole('group', { name: 'Verification steps' });
  const next = stepper.getByRole('button', { name: /next/i });
  await expect(next).toBeEnabled();

  // A wrong citation is caught at the grounding gate (step until that beat shows).
  await stepUntilVisible(next, demo.getByText(/blocked at the grounding gate/i).first());

  // The honest limit: an output clears every gate and is still wrong.
  await stepUntilVisible(next, demo.getByRole('heading', { name: /What every gate still misses/i }));
  await expect(demo.getByText(/proceeds — yet the output is wrong/i)).toBeVisible();

  // Nine-section body + the crisp three-way distinction.
  await expect(page.getByRole('heading', { name: 'When should I avoid it?' })).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Verification vs reflection vs evaluation' }),
  ).toBeVisible();

  // Governance: guardrails/verification as controls and audit evidence, with the limit.
  await expect(page.getByText(/passing-check trail is audit evidence/i)).toBeVisible();

  // Interview package: the critical-thinking "green but wrong" question renders.
  await expect(page.getByText(/verification suite is all green, but the output is still wrong/i)).toBeVisible();
});

test('verification appears on the concepts index as a complete core-mechanism concept', async ({
  page,
}) => {
  await page.goto('/concepts?status=complete');
  await expect(
    page.getByRole('link', { name: 'Verification (guardrails & checks)' }),
  ).toBeVisible();
});
