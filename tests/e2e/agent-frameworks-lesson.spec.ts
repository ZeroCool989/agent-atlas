import { expect, test } from '@playwright/test';

test('agent-frameworks lesson: mental model, steppable two-ways viz hydrates, honest framing, governance, interview', async ({
  page,
}) => {
  await page.goto('/concepts/agent-frameworks');

  // Mental model with its breaking point.
  await expect(
    page.getByText(/Mental model: an automatic transmission over a manual gearbox/),
  ).toBeVisible();
  await expect(page.getByText(/Where the analogy breaks/)).toBeVisible();

  // The honest load-bearing point: scaffolding over the loop, not new capability.
  await expect(page.getByText(/It is scaffolding, not new capability/)).toBeVisible();

  // The Tier-2 viz renders its static first frame (step 0 title, nothing run yet).
  await expect(page.getByTestId('af-title')).toHaveText('Same task, two ways');
  await expect(page.getByTestId('af-visible')).toContainText('0/');

  // The steppable island hydrates: Astro drops the `ssr` attribute once hydrated —
  // interacting before hydration is a race, so wait for it.
  const stepper = page.getByRole('group', { name: 'Agent frameworks steps' });
  await stepper.scrollIntoViewIfNeeded();
  const island = page.locator('astro-island', { has: stepper });
  await expect(island).not.toHaveAttribute('ssr', /.*/);
  const next = stepper.getByRole('button', { name: 'Next' });
  await expect(next).toBeEnabled();

  // Step to the end (bounded): advance until the reveal appears, then assert it.
  const reveal = page.getByTestId('af-reveal');
  for (let i = 0; i < 20 && !(await reveal.isVisible()); i++) {
    await next.click();
  }
  await expect(reveal).toBeVisible();
  await expect(reveal).toContainText(/Identical trace, identical answer/);
  // The tally shows runtime steps are now hidden inside .run() on the framework side.
  await expect(page.getByTestId('af-hidden')).toContainText(/out of sight:\s*[1-9]/);

  // Governance section makes the supply-chain + trust-surface point.
  await expect(page.getByText(/supply-chain dependency and a trust surface/).first()).toBeVisible();

  // Interview package renders the critical-thinking question.
  await expect(
    page.getByText(/A team wants to adopt LangGraph or CrewAI for a new agent/),
  ).toBeVisible();
});

test('agent-frameworks appears on the concepts index as a complete framework-abstraction concept', async ({
  page,
}) => {
  await page.goto('/concepts?status=complete');
  await expect(page.getByRole('link', { name: /Agent Frameworks/ })).toBeVisible();
});
