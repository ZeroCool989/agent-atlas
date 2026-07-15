import { expect, test } from '@playwright/test';

test('structured outputs lesson: mental model, live pipeline viz, evidence, misconceptions', async ({ page }) => {
  await page.goto('/concepts/structured-outputs');

  // Mental model with its breaking point
  await expect(page.getByText(/Mental model: dictation to a clerk/)).toBeVisible();
  await expect(page.getByText(/Where the analogy breaks/)).toBeVisible();

  // The pipeline viz island: SSR frame, hydrate, step through cases
  const viz = page.locator('section[aria-label="Structured extraction pipeline"]');
  await expect(viz.getByText('Clean JSON')).toBeVisible();
  const island = page.locator('astro-island', { has: viz });
  await island.scrollIntoViewIfNeeded();
  await expect(island).not.toHaveAttribute('ssr', /.*/);

  // Fenced case shows the isolate stage; unrecoverable ends in a typed failure
  await viz.locator('label', { hasText: 'Markdown-fenced JSON' }).click();
  await expect(viz.getByText('Isolate JSON').first()).toBeVisible();
  await viz.locator('label', { hasText: 'Never valid' }).click();
  await expect(viz.getByText('typed failure').first()).toBeVisible();

  // Evidence section: measured 008 with the wrong-key finding, distinguished from scripted
  await expect(page.getByRole('heading', { name: 'Evidence from real experiments' })).toBeVisible();
  await expect(page.getByText(/Measured — Experiment 008/)).toBeVisible();
  await expect(page.getByText(/wrong key .*location.* instead of .*city/)).toBeVisible();

  // Misconceptions + the tool-calling relationship
  await expect(page.getByRole('heading', { name: 'Common misconceptions' })).toBeVisible();
  await expect(page.getByText(/a tool call.s arguments are a structured output/).first()).toBeVisible();

  // Interview package (whiteboard question)
  await expect(page.getByText(/Whiteboard a robust structured-output extractor/)).toBeVisible();
});

test('structured outputs is a complete concept and a tool-calling prerequisite', async ({ page }) => {
  await page.goto('/concepts?status=complete');
  await expect(page.getByRole('link', { name: 'Structured outputs' })).toBeVisible();

  // Tool calling now lists structured outputs under "Learn these first"
  await page.goto('/concepts/tool-calling');
  const prereqs = page.getByRole('heading', { name: 'Learn these first' }).locator('..');
  await expect(prereqs.getByRole('link', { name: 'Structured outputs' })).toBeVisible();
});
