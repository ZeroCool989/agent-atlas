import { expect, test } from '@playwright/test';

test('rag lesson: mental model, steppable pipeline viz hydrates, governance, interview', async ({
  page,
}) => {
  await page.goto('/concepts/rag');

  await expect(
    page.getByRole('heading', { level: 1, name: 'Retrieval-augmented generation (RAG)' }),
  ).toBeVisible();

  // Mental model with its breaking point.
  await expect(page.getByText(/Mental model: an open-book exam/)).toBeVisible();
  await expect(page.getByText(/Where the analogy breaks/)).toBeVisible();

  // The Tier-2 pipeline visual: server-rendered first frame (the question stage).
  const stepper = page.getByRole('group', { name: 'RAG pipeline steps' });
  await stepper.scrollIntoViewIfNeeded();
  // Wait for the client:visible island to hydrate before interacting (Astro drops the
  // `ssr` attribute from <astro-island> once hydrated) — clicking before hydration is a race.
  const island = page.locator('astro-island', { has: stepper });
  await expect(island).not.toHaveAttribute('ssr', /.*/);
  const next = stepper.getByRole('button', { name: 'Next' });
  await expect(next).toBeEnabled();
  await next.click(); // advance to the retrieve stage

  // Advancing reveals a real retrieved passage from the pipeline (the top billing chunk).
  await expect(page.getByText(/To cancel your subscription/).first()).toBeVisible();

  // Governance section makes the GDPR/retrieved-data point.
  await expect(page.getByText(/Retrieved personal data is still processing/).first()).toBeVisible();

  // Nine-section body renders.
  await expect(page.getByRole('heading', { name: 'When should I avoid it?' })).toBeVisible();

  // Interview package: the critical-thinking question renders.
  await expect(page.getByText(/first instinct for every/i)).toBeVisible();
});

test('rag appears on the concepts index as a complete core-mechanism concept', async ({ page }) => {
  await page.goto('/concepts?status=complete');
  await expect(
    page.getByRole('link', { name: 'Retrieval-augmented generation (RAG)' }),
  ).toBeVisible();
});
