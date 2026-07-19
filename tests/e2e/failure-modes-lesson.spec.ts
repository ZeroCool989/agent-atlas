import { expect, test } from '@playwright/test';

test('failure-modes lesson: mental model, steppable citation-check viz, misconceptions, interview', async ({
  page,
}) => {
  await page.goto('/concepts/failure-modes');

  await expect(
    page.getByRole('heading', { level: 1, name: 'Hallucination & Failure Modes' }),
  ).toBeVisible();

  // Mental model with its breaking point.
  await expect(page.getByText(/Mental model: a brilliant improviser/)).toBeVisible();
  await expect(page.getByText(/Where the analogy breaks/)).toBeVisible();

  // Tier-2 citation-check visual: server-rendered first frame (step 1, nothing checked).
  const demo = page.locator('section[aria-label="Citation check walkthrough"]');
  await expect(demo.getByRole('heading', { name: /A confident, grounded-looking answer/ })).toBeVisible();

  // Wait for the client:visible island to hydrate before interacting (avoids a click-race).
  const island = page.locator('astro-island', { has: demo });
  await island.scrollIntoViewIfNeeded();
  await expect(island).not.toHaveAttribute('ssr', /.*/);

  // Stepping reveals the checker's verdict on the first (validly-cited) sentence.
  const stepper = demo.getByRole('group', { name: 'Citation check steps' });
  const next = stepper.getByRole('button', { name: /next/i });
  await expect(next).toBeEnabled();
  await next.click();
  await expect(demo.getByText(/citation resolves/i).first()).toBeVisible();

  // Nine-section body + the honest "you cannot eliminate it" stance.
  await expect(page.getByRole('heading', { name: 'When should I avoid it?' })).toBeVisible();
  await expect(page.getByText(/RAG fixes hallucination/)).toBeVisible();

  // Interview package: the critical-thinking question renders.
  await expect(page.getByText(/make the model stop hallucinating/i)).toBeVisible();
});

test('failure-modes appears on the concepts index as a complete foundation concept', async ({
  page,
}) => {
  await page.goto('/concepts?status=complete');
  await expect(page.getByRole('link', { name: 'Hallucination & Failure Modes' })).toBeVisible();
});
