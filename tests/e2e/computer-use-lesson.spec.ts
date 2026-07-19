import { expect, test } from '@playwright/test';

test('computer-use lesson: mental model, steppable perceive-decide-act viz with injection refusal and confirmation, interview', async ({
  page,
}) => {
  await page.goto('/concepts/computer-use');

  await expect(page.getByRole('heading', { level: 1, name: 'Computer use (GUI agents)' })).toBeVisible();

  // The Tier-2 viz: server-rendered first frame (the first screenshot of the inbox).
  const demo = page.locator('section[aria-label="Computer use walkthrough"]');
  await expect(demo.getByRole('heading', { name: /Perceive: take a screenshot/ })).toBeVisible(); // SSR

  // The steppable island hydrates before we interact (clicking before hydration is a race).
  const island = page.locator('astro-island', { has: demo });
  await island.scrollIntoViewIfNeeded();
  await expect(island).not.toHaveAttribute('ssr', /.*/);

  const stepper = demo.getByRole('group', { name: 'Computer use steps' });
  const next = stepper.getByRole('button', { name: /next/i });
  await expect(next).toBeEnabled();

  // Step forward until the injected instruction is refused by the runtime gate (don't hard-code its index).
  const refusedBeat = demo.getByText(/REFUSED|injected instruction is blocked/i).first();
  for (let i = 0; i < 20 && !(await refusedBeat.isVisible()); i += 1) await next.click();
  await expect(refusedBeat).toBeVisible();

  // Continue until a genuinely consequential action pauses for confirmation.
  const confirmBeat = demo.getByText(/pauses for confirmation|Awaiting confirmation/i).first();
  for (let i = 0; i < 20 && !(await confirmBeat.isVisible()); i += 1) await next.click();
  await expect(confirmBeat).toBeVisible();

  // Continue to the goal-reached outcome.
  const outcome = demo.getByText(/Outcome:\s*completed/i).first();
  for (let i = 0; i < 20 && !(await outcome.isVisible()); i += 1) await next.click();
  await expect(outcome).toBeVisible();

  // Nine-section body: the honest "when to avoid" answer.
  await expect(page.getByRole('heading', { name: 'When should I avoid it?' })).toBeVisible();
  await expect(page.getByText(/last resort|no better door|almost always/i).first()).toBeVisible();

  // Interview package: the critical-thinking question renders (in a details disclosure).
  await expect(page.getByText(/When should you NOT use computer use/i)).toBeVisible();
});

test('computer-use appears on the concepts index as a complete advanced-system concept', async ({ page }) => {
  await page.goto('/concepts?status=complete');
  await expect(page.getByRole('link', { name: 'Computer use (GUI agents)' })).toBeVisible();
});
