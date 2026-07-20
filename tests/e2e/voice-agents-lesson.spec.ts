import { expect, test } from '@playwright/test';

test('voice-agents lesson: mental model, steppable pipeline viz with latency budget, mistranscription and barge-in, interview', async ({
  page,
}) => {
  await page.goto('/concepts/voice-agents');

  await expect(page.getByRole('heading', { level: 1, name: 'Voice agents' })).toBeVisible();

  // The Tier-2 viz: server-rendered first frame (the user starting to speak).
  const demo = page.locator('section[aria-label="Voice agent walkthrough"]');
  await expect(demo.getByRole('heading', { name: /User starts speaking/ })).toBeVisible(); // SSR

  // The steppable island hydrates before we interact (clicking before hydration is a race).
  const island = page.locator('astro-island', { has: demo });
  await island.scrollIntoViewIfNeeded();
  await expect(island).not.toHaveAttribute('ssr', /.*/);

  const stepper = demo.getByRole('group', { name: 'Voice agent steps' });
  const next = stepper.getByRole('button', { name: /next/i });
  await expect(next).toBeEnabled();

  // Step forward until ASR mis-hears (don't hard-code its index).
  const misheard = demo.getByText(/ASR heard this, not what was said|mis-heard/i).first();
  for (let i = 0; i < 20 && !(await misheard.isVisible()); i += 1) await next.click();
  await expect(misheard).toBeVisible();

  // Continue until the end-to-end latency budget is shown to be over budget.
  const overBudget = demo.getByText(/over budget/i).first();
  for (let i = 0; i < 20 && !(await overBudget.isVisible()); i += 1) await next.click();
  await expect(overBudget).toBeVisible();

  // Continue until the user barges in and the floor returns to listening.
  const barge = demo.getByText(/barge-in|the user interrupts/i).first();
  for (let i = 0; i < 20 && !(await barge.isVisible()); i += 1) await next.click();
  await expect(barge).toBeVisible();

  // Continue to the terminal outcome (interrupted, wrong answer spoken).
  const outcome = demo.getByText(/Outcome:\s*interrupted/i).first();
  for (let i = 0; i < 20 && !(await outcome.isVisible()); i += 1) await next.click();
  await expect(outcome).toBeVisible();

  // Nine-section body: the honest "when to avoid" answer (text is the default).
  await expect(page.getByRole('heading', { name: 'When should I avoid it?' })).toBeVisible();
  await expect(page.getByText(/the honest default is text|most of the time/i).first()).toBeVisible();

  // Interview package: the critical-thinking question renders (in a details disclosure).
  await expect(page.getByText(/When is voice the wrong interface/i)).toBeVisible();
});

test('voice-agents appears on the concepts index as a complete advanced-system concept', async ({ page }) => {
  await page.goto('/concepts?status=complete');
  await expect(page.getByRole('link', { name: 'Voice agents' })).toBeVisible();
});
