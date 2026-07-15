import { expect, test } from '@playwright/test';

test('tool calling lesson: mental model, three-layer validation viz, playground, evidence, governance', async ({ page }) => {
  await page.goto('/concepts/tool-calling');

  // Mental model with its breaking point
  await expect(page.getByText(/Mental model: the model writes a work order/)).toBeVisible();
  await expect(page.getByText(/Where the analogy breaks/)).toBeVisible();

  // Signature static viz: the three gates, with the measured 2 ** 0.5 case — zero JS for this part
  const gates = page.getByRole('group', { name: 'Three validation layers' });
  await expect(gates).toBeVisible();
  await expect(gates.getByText('2 ** 0.5', { exact: false }).first()).toBeVisible();
  await expect(gates.getByText(/measured · Experiment 006/).first()).toBeVisible();
  await expect(gates.getByText(/unexpected character/).first()).toBeVisible();

  // Playground island: outcome-class comparison over real/scripted traces
  const playground = page.locator('section[aria-label="Tool calling playground"]');
  await expect(playground.getByRole('heading', { name: 'Run started' })).toBeVisible(); // SSR frame
  const island = page.locator('astro-island', { has: playground });
  await island.scrollIntoViewIfNeeded();
  await expect(island).not.toHaveAttribute('ssr', /.*/);

  // The success case is the MEASURED Experiment 005 trace (wrapper override).
  await expect(playground.getByText(/measured · Experiment 005/)).toBeVisible();
  await playground.locator('label', { hasText: 'Semantic failure' }).click();
  await expect(playground.getByText(/measured · Experiment 006/)).toBeVisible();
  await expect(playground.getByText('tool-error').first()).toBeVisible();
  await playground.locator('label', { hasText: 'Unknown tool' }).click();
  await expect(playground.getByText('invalid-tool-request').first()).toBeVisible();

  // Evidence section distinguishes measured vs scripted
  await expect(page.getByRole('heading', { name: 'Evidence from real experiments' })).toBeVisible();
  await expect(page.getByText(/Measured — Experiment 006/)).toBeVisible();

  // Security + governance sections with careful regulatory wording
  await expect(page.getByRole('heading', { name: 'Security' })).toBeVisible();
  await expect(page.getByText(/The model never owns security. The runtime always does./)).toBeVisible();
  await expect(page.getByText(/applies .*merely because.* a system calls tools/)).toBeVisible();

  // Interview package renders the whiteboard question
  await expect(page.getByText(/Whiteboard the validation path for a tool call/)).toBeVisible();
});

test('tool calling appears on the concepts index as a complete core-mechanism concept', async ({ page }) => {
  await page.goto('/concepts?status=complete');
  await expect(page.getByRole('link', { name: 'Tool calling' })).toBeVisible();
});
