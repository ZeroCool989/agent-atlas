import { expect, test } from '@playwright/test';

test('flagship lesson: mental model, live four-architecture comparison, table, governance wording', async ({ page }) => {
  await page.goto('/concepts/workflows-vs-agents');

  // Mental model with its breaking point
  await expect(page.getByText(/Mental model: recipe → taste-tester → contractor/)).toBeVisible();
  await expect(page.getByText(/Where the analogy breaks/)).toBeVisible();

  // The comparison island: SSR first frame shows real trace data
  const comparison = page.locator('section[aria-label="Architecture comparison"]');
  await expect(comparison.getByText('“What is 127 * 49?”')).toBeVisible();
  await expect(comparison.getByRole('heading', { name: 'Run started' })).toBeVisible();

  // Hydrate (client:visible below the fold), then switch architectures and step
  const island = page.locator('astro-island', { has: comparison });
  await island.scrollIntoViewIfNeeded();
  await expect(island).not.toHaveAttribute('ssr', /.*/);

  await comparison.locator('label', { hasText: 'Deterministic workflow' }).click();
  await expect(comparison.getByText('The developer decided every step, in advance', { exact: false })).toBeVisible();
  await expect(comparison.getByText('127 × 49 = 6,223')).toBeVisible();

  await comparison.locator('label', { hasText: 'Tool-using agent' }).click();
  await expect(comparison.getByText(/^Step 1 of 10$/)).toBeVisible(); // switch resets the timeline
  const toolbar = comparison.locator('[role="group"][aria-label="Tool-using agent trace steps"]');
  await toolbar.getByRole('button', { name: 'Next' }).click();
  await toolbar.getByRole('button', { name: 'Next' }).click();
  await toolbar.getByRole('button', { name: 'Next' }).click();
  await expect(comparison.getByRole('heading', { name: 'Model selected tool: calculator' })).toBeVisible();
  await expect(comparison.getByText(/model decided/).first()).toBeVisible();

  // Direct call is labeled honestly wrong
  await comparison.locator('label', { hasText: 'Direct model call' }).click();
  await expect(comparison.getByText(/confidently wrong/)).toBeVisible();

  // Comparison table and minimum-loop mechanics in the prose
  await expect(page.getByRole('cell', { name: 'model, per turn' })).toBeVisible();
  await expect(page.getByText('The minimum agent loop')).toBeVisible();

  // Governance: careful applicability wording, engineering-first framing
  await expect(page.getByText(/none of the EU AI Act, DORA, GDPR/)).toBeVisible();
  await expect(page.getByText(/Applicability depends on the system, your role/)).toBeVisible();
  await expect(page.getByText(/Least privilege/)).toBeVisible();

  // Interview package renders with the whiteboard question
  await expect(page.getByText(/Whiteboard a minimal tool-using agent runtime/)).toBeVisible();
});
