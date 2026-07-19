import { expect, test } from '@playwright/test';

test('multi-agent lesson: mental model, flagship org-chart viz with a critic rejection, re-delegation, cost contrast, interview', async ({
  page,
}) => {
  await page.goto('/concepts/multi-agent-systems');

  await expect(page.getByRole('heading', { level: 1, name: 'Multi-agent systems' })).toBeVisible();

  // The Tier-2 flagship viz: server-rendered first frame (the decomposition beat).
  const demo = page.locator('section[aria-label="Multi-agent orchestration walkthrough"]');
  await expect(demo.getByRole('heading', { name: /One goal, split across specialists/ })).toBeVisible(); // SSR

  // The org-chart graph renders as an accessible image.
  await expect(demo.getByRole('img', { name: /model calls so far/i })).toBeVisible();

  // The steppable island hydrates before we interact (clicking before hydration is a race).
  const island = page.locator('astro-island', { has: demo });
  await island.scrollIntoViewIfNeeded();
  await expect(island).not.toHaveAttribute('ssr', /.*/);

  const stepper = demo.getByRole('group', { name: 'Multi-agent steps' });
  const next = stepper.getByRole('button', { name: /next/i });
  await expect(next).toBeEnabled();

  // Step forward until the independent critic rejects the writer's draft (don't hard-code its index).
  const criticBeat = demo.getByText(/Unsupported claim|independent critic rejects|reports a failure/i).first();
  for (let i = 0; i < 20 && !(await criticBeat.isVisible()); i += 1) await next.click();
  await expect(criticBeat).toBeVisible();

  // Continue to the honest contrast beat: multi-agent vs. one well-structured agent.
  const contrastBeat = demo.getByText(/Multi-agent vs\. one well-structured agent/i);
  for (let i = 0; i < 20 && !(await contrastBeat.isVisible()); i += 1) await next.click();
  await expect(contrastBeat).toBeVisible();
  // The contrast is honest both ways: a case each architecture wins.
  await expect(demo.getByText(/Better here: the multi-agent system/i)).toBeVisible();
  await expect(demo.getByText(/Better here: a single agent/i)).toBeVisible();

  // Nine-section body: the honest "when to avoid" answer, unhedged.
  await expect(page.getByRole('heading', { name: 'When should I avoid it?' })).toBeVisible();
  await expect(page.getByText(/architecture-astronomy/i).first()).toBeVisible();

  // Interview package: the critical-thinking question renders.
  await expect(page.getByText(/When is multi-agent the wrong call/i)).toBeVisible();
});

test('multi-agent-systems appears on the concepts index as a complete advanced-system concept', async ({
  page,
}) => {
  await page.goto('/concepts?status=complete');
  await expect(page.getByRole('link', { name: 'Multi-agent systems' })).toBeVisible();
});
