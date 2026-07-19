import { expect, test } from '@playwright/test';

test('prompt-engineering lesson: mental model, steppable prompt-assembly viz, nine sections, interview', async ({
  page,
}) => {
  await page.goto('/concepts/prompt-engineering');

  await expect(page.getByRole('heading', { level: 1, name: 'Prompt engineering' })).toBeVisible();

  // Mental model with its breaking point (honest-analogy rule).
  await expect(page.getByText(/briefing a brilliant, literal contractor/)).toBeVisible();
  await expect(page.getByText(/Where the analogy breaks/)).toBeVisible();

  // The Tier-2 assembly visual renders its server frame (empty context, nothing revealed).
  const demo = page.locator('section[aria-label="Prompt assembly walkthrough"]');
  await expect(demo.getByRole('heading', { name: /An empty context/ })).toBeVisible(); // SSR frame
  await expect(demo.getByText(/Empty context — the model sees nothing yet/)).toBeVisible();

  // Wait for the client:visible island to hydrate before interacting (avoids a click race).
  await demo.scrollIntoViewIfNeeded();
  const island = page.locator('astro-island', { has: demo });
  await expect(island).not.toHaveAttribute('ssr', /.*/);

  // Stepping assembles the prompt: advancing reveals the system part and its token cost.
  const stepper = demo.getByRole('group', { name: 'Prompt assembly steps' });
  const next = stepper.getByRole('button', { name: /next/i });
  await expect(next).toBeEnabled();
  await next.click();
  await expect(demo.getByRole('heading', { name: /System — role and rules/ })).toBeVisible();
  await expect(demo.getByText(/tokens/).first()).toBeVisible();

  // Nine-section body renders (canonical questions) and the honest "wrong fix" point.
  await expect(page.getByRole('heading', { name: 'When should I avoid it?' })).toBeVisible();
  await expect(page.getByText(/no prompt supplies missing knowledge/)).toBeVisible();

  // A load-bearing misconception is stated.
  await expect(page.getByText(/There are magic words that unlock the model/)).toBeVisible();

  // Security/governance: the prompt-injection surface point.
  await expect(page.getByText(/injection surface/)).toBeVisible();

  // Interview package: the critical-thinking / wrong-fix question renders.
  await expect(
    page.getByText(/When is more prompt engineering the wrong fix/i),
  ).toBeVisible();
});

test('prompt engineering appears on the concepts index as a complete core-mechanism concept', async ({
  page,
}) => {
  await page.goto('/concepts?status=complete');
  await expect(page.getByRole('link', { name: 'Prompt engineering' })).toBeVisible();
});
