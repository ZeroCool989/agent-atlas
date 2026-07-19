import { expect, test } from '@playwright/test';

test('memory lesson: mental model, steppable memory timeline hydrates, governance, interview', async ({
  page,
}) => {
  await page.goto('/concepts/memory');

  await expect(page.getByRole('heading', { level: 1, name: 'Memory' })).toBeVisible();

  // Mental model with its breaking point.
  await expect(page.getByText(/Mental model: a desk with a notebook/)).toBeVisible();
  await expect(page.getByText(/Where the analogy breaks/)).toBeVisible();

  // The Tier-2 timeline viz renders its server frame (working-memory window visible).
  await expect(page.getByText('Agent memory · The conversation grows')).toBeVisible();

  // The steppable island hydrates before we interact (avoid the click-race).
  const stepper = page.getByRole('group', { name: 'Agent memory steps' });
  await stepper.scrollIntoViewIfNeeded();
  const island = page.locator('astro-island', { has: stepper });
  await expect(island).not.toHaveAttribute('ssr', /.*/);

  const next = stepper.getByRole('button', { name: 'Next' });
  await expect(next).toBeEnabled();
  await next.click(); // compact
  await expect(page.getByText(/Summary of .* older turn\(s\)/).first()).toBeVisible();
  await next.click(); // retrieve
  await expect(page.getByText(/nearest stored turns/).first()).toBeVisible();

  // Nine-section body + the honest "memory is not learning" point.
  await expect(page.getByRole('heading', { name: 'When should I avoid it?' })).toBeVisible();
  await expect(page.getByText(/it does not make the model \*?\*?learn|does not make the model/i)).toBeVisible();

  // Governance section makes the GDPR/personal-data point.
  await expect(page.getByText(/storing user conversation history/i)).toBeVisible();

  // Interview package: the critical-thinking question renders.
  await expect(page.getByText(/over-engineering/i).first()).toBeVisible();
});

test('memory appears on the concepts index as a complete concept', async ({ page }) => {
  await page.goto('/concepts?status=complete');
  await expect(page.getByRole('link', { name: 'Memory' })).toBeVisible();
});
