import { expect, test } from '@playwright/test';

test('prompt-injection lesson: mental model, steppable naive-vs-mitigated viz with exfiltration then refusal, interview', async ({
  page,
}) => {
  await page.goto('/concepts/prompt-injection');

  await expect(
    page.getByRole('heading', { level: 1, name: 'Prompt injection & LLM security' }),
  ).toBeVisible();

  // The Tier-2 viz: server-rendered first frame (the setup framing at step 0).
  const demo = page.locator('section[aria-label="Prompt injection walkthrough"]');
  await expect(demo.getByRole('heading', { name: /One request, two pipelines/ })).toBeVisible(); // SSR

  // The steppable island hydrates before we interact (clicking before hydration is a race).
  const island = page.locator('astro-island', { has: demo });
  await island.scrollIntoViewIfNeeded();
  await expect(island).not.toHaveAttribute('ssr', /.*/);

  const stepper = demo.getByRole('group', { name: 'Prompt injection steps' });
  const next = stepper.getByRole('button', { name: /next/i });
  await expect(next).toBeEnabled();

  // Step forward until the naive pipeline executes the injected action and exfiltrates data
  // (don't hard-code its index).
  const harmBeat = demo.getByText(/exfiltrat/i).first();
  for (let i = 0; i < 25 && !(await harmBeat.isVisible()); i += 1) await next.click();
  await expect(harmBeat).toBeVisible();

  // Continue until the mitigated pipeline refuses the SAME injected action via layered controls.
  const blockBeat = demo.getByText(/injected action blocked|Refused by layered controls/i).first();
  for (let i = 0; i < 25 && !(await blockBeat.isVisible()); i += 1) await next.click();
  await expect(blockBeat).toBeVisible();

  // Continue to the mitigated outcome: injection refused, legitimate task completed.
  const outcome = demo.getByText(/injection refused/i).first();
  for (let i = 0; i < 25 && !(await outcome.isVisible()); i += 1) await next.click();
  await expect(outcome).toBeVisible();

  // Nine-section body: the load-bearing honesty in "when to avoid".
  await expect(page.getByRole('heading', { name: 'When should I avoid it?' })).toBeVisible();
  await expect(page.getByText(/never get to.*avoid the risk|better system prompt|bypassable/i).first()).toBeVisible();

  // Interview package: the critical-thinking question renders.
  await expect(page.getByText(/just fix prompt injection with a better system prompt/i)).toBeVisible();
});

test('prompt-injection appears on the concepts index as a complete core-mechanism concept', async ({ page }) => {
  await page.goto('/concepts?status=complete');
  await expect(page.getByRole('link', { name: 'Prompt injection & LLM security' })).toBeVisible();
});
