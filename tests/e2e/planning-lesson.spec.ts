import { expect, test } from '@playwright/test';

test('planning lesson: mental model, steppable plan-then-execute viz with re-plan, contrast, interview', async ({
  page,
}) => {
  await page.goto('/concepts/planning');

  await expect(page.getByRole('heading', { level: 1, name: 'Planning' })).toBeVisible();

  // The Tier-2 viz: server-rendered first frame (the full plan, before acting).
  const demo = page.locator('section[aria-label="Planning walkthrough"]');
  await expect(demo.getByRole('heading', { name: /A whole plan, before acting/ })).toBeVisible(); // SSR

  // The steppable island hydrates before we interact (clicking before hydration is a race).
  const island = page.locator('astro-island', { has: demo });
  await island.scrollIntoViewIfNeeded();
  await expect(island).not.toHaveAttribute('ssr', /.*/);

  const stepper = demo.getByRole('group', { name: 'Planning steps' });
  const next = stepper.getByRole('button', { name: /next/i });
  await expect(next).toBeEnabled();

  // Step forward until the failure beat shows (don't hard-code its index).
  const failBeat = demo.getByText(/A step fails|A greedy agent would be stuck here|fail/i).first();
  for (let i = 0; i < 15 && !(await failBeat.isVisible()); i += 1) await next.click();
  await expect(failBeat).toBeVisible();

  // Continue to the final contrast beat: the greedy, planless run that drifts.
  const greedyBeat = demo.getByText(/Greedy, one step at a time/);
  for (let i = 0; i < 15 && !(await greedyBeat.isVisible()); i += 1) await next.click();
  await expect(greedyBeat).toBeVisible();

  // Nine-section body: the honest "when to avoid" answer.
  await expect(page.getByRole('heading', { name: 'When should I avoid it?' })).toBeVisible();
  await expect(page.getByText(/confidently.*wrong/i).first()).toBeVisible();

  // Interview package: the critical-thinking question renders (in a details disclosure).
  await expect(page.getByText(/when would planning make things worse/i)).toBeVisible();
});

test('planning appears on the concepts index as a complete useful-addition concept', async ({ page }) => {
  await page.goto('/concepts?status=complete');
  await expect(page.getByRole('link', { name: 'Planning' })).toBeVisible();
});
