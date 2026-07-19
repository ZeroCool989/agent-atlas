import { expect, test } from '@playwright/test';

test('reflection lesson: mental model, steppable critique viz hydrates, governance, interview', async ({
  page,
}) => {
  await page.goto('/concepts/reflection');

  // Mental model with its breaking point.
  await expect(page.getByText(/Mental model: a writer with an editor pass/)).toBeVisible();
  await expect(page.getByText(/Where the analogy breaks/)).toBeVisible();

  // The Tier-2 viz renders its server frame (goal visible, initial draft, nothing revised yet).
  await expect(page.getByText(/Goal:/).first()).toBeVisible();
  await expect(page.getByText(/Fixed a bug\./)).toBeVisible();

  // The steppable island hydrates before we interact (Astro drops the `ssr` attribute from
  // <astro-island> once hydrated) — clicking before hydration is a race.
  const stepper = page.getByRole('group', { name: 'Reflection steps' });
  await stepper.scrollIntoViewIfNeeded();
  const island = page.locator('astro-island', { has: stepper });
  await expect(island).not.toHaveAttribute('ssr', /.*/);

  const next = stepper.getByRole('button', { name: 'Next' });

  // Step forward until the honest caveat beat is visible — bounded loop, no hard-coded index,
  // robust to the exact number of frames in the trace.
  const caveat = page.getByText(/Self-critique is not independent verification/);
  for (let i = 0; i < 12 && !(await caveat.isVisible()); i += 1) {
    await expect(next).toBeEnabled();
    await next.click();
  }
  await expect(caveat).toBeVisible();
  // The load-bearing number: the critic is 100% confident on the wrong answer.
  await expect(page.getByText('100%').first()).toBeVisible();

  // Governance section makes the independence point.
  await expect(page.getByText(/not independent assurance/)).toBeVisible();

  // Interview package renders the critical-thinking question.
  await expect(
    page.getByText(/When does adding reflection make an agent's output worse/),
  ).toBeVisible();
});

test('reflection appears on the concepts index as a complete useful-addition concept', async ({
  page,
}) => {
  await page.goto('/concepts?status=complete');
  await expect(page.getByRole('link', { name: 'Reflection' })).toBeVisible();
});
