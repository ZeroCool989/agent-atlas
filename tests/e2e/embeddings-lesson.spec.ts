import { expect, test } from '@playwright/test';

test('embeddings lesson: mental model, steppable retrieval viz hydrates, governance, interview', async ({
  page,
}) => {
  await page.goto('/concepts/embeddings');

  // Mental model with its breaking point.
  await expect(page.getByText(/Mental model: a map of meaning/)).toBeVisible();
  await expect(page.getByText(/Where the analogy breaks/)).toBeVisible();

  // The Tier-2 retrieval viz renders its server frame (query visible, nothing revealed yet).
  await expect(page.getByText('Nearest neighbors of “king”')).toBeVisible();

  // The steppable island hydrates: advancing reveals the nearest neighbor and its real score.
  const stepper = page.getByRole('group', { name: 'Nearest-neighbor ranking of king' });
  await stepper.scrollIntoViewIfNeeded();
  const next = stepper.getByRole('button', { name: 'Next' });
  await expect(next).toBeEnabled();
  await next.click();
  await expect(page.getByText(/Nearest #1: “queen”/).first()).toBeVisible();

  // Governance section makes the GDPR/derived-data point.
  await expect(page.getByText(/Embeddings are a data-protection surface/)).toBeVisible();
  await expect(page.getByText(/Derived personal data is still personal data/)).toBeVisible();

  // Interview package renders the critical-thinking question.
  await expect(page.getByText(/When would you tell them NOT to use embeddings/)).toBeVisible();
});

test('embeddings appears on the concepts index as a complete core-mechanism concept', async ({
  page,
}) => {
  await page.goto('/concepts?status=complete');
  await expect(page.getByRole('link', { name: 'Embeddings' })).toBeVisible();
});
