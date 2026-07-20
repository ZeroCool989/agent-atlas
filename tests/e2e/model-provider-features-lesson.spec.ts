import { expect, test, type Locator } from '@playwright/test';

/**
 * Advance nothing here — this lesson's visual is toggle-driven, not stepped — but keep
 * interactions bounded and attribute-driven so the test stays robust to copy changes.
 */
async function firstVisible(candidates: Locator[]): Promise<Locator> {
  for (const c of candidates) {
    if (await c.isVisible()) return c;
  }
  return candidates[0]!;
}

test('model-provider-features lesson: mental model, native/portable explorer, nine sections, governance, interview', async ({
  page,
}) => {
  await page.goto('/concepts/model-provider-features');

  await expect(page.getByRole('heading', { level: 1, name: 'Model-provider features' })).toBeVisible();

  // Mental model with its breaking point.
  await expect(page.getByText(/Mental model: a proprietary port on a standard tool/)).toBeVisible();
  await expect(page.getByText(/Where the analogy breaks/)).toBeVisible();

  // The interactive visual: server-rendered first frame (default = every need on the native surface).
  const demo = page.locator('section[aria-label="Provider-features portability explorer"]');
  await expect(demo.getByRole('heading', { name: /Native wrapper, or portable primitive/i })).toBeVisible();

  // Wait for the client:visible island to hydrate before interacting (avoids a click-race).
  const island = page.locator('astro-island', { has: demo });
  await island.scrollIntoViewIfNeeded();
  await expect(island).not.toHaveAttribute('ssr', /.*/);

  // Interaction 1: toggling a need from the native wrapper to the portable primitive flips its
  // resolved path (attribute-driven, no reliance on exact score numbers).
  const memoryRow = demo.locator('[data-capability="provider-memory"]');
  await expect(memoryRow).toHaveAttribute('data-effective', 'native');
  await memoryRow.getByRole('button', { name: 'Portable' }).click();
  await expect(memoryRow).toHaveAttribute('data-effective', 'portable');

  // Interaction 2: switching to the primitives-only provider forces native picks onto the fallback
  // — the wrapper is provider-specific, the primitive is not.
  const providerC = await firstVisible([
    demo.getByRole('button', { name: /Provider C/i }),
    demo.getByRole('button', { name: /primitives only/i }),
  ]);
  await providerC.click();
  await expect(demo.locator('[data-effective="portable"]').first()).toBeVisible();

  // Nine canonical sections (spot-check the anchors that bracket the body).
  await expect(page.getByRole('heading', { name: 'What problem existed before this?' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'How does it work?' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'When should I avoid it?' })).toBeVisible();

  // The primitive-vs-wrapper thesis and the misconceptions section.
  await expect(page.getByRole('heading', { name: /The categories change fast/i })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Common misconceptions' })).toBeVisible();

  // Governance: portability/lock-in, data residency, and hosted-tool auditability.
  await expect(page.getByRole('heading', { name: 'Security and governance' })).toBeVisible();
  await expect(page.getByText(/data residency/i).first()).toBeVisible();
  await expect(page.getByText(/Auditability of hosted tools/i).first()).toBeVisible();

  // Interview package renders on the page (a distinctive phrase from the migration question).
  await expect(page.getByText(/leans hard on one provider/i).first()).toBeVisible();
});

test('model-provider-features appears on the concepts index as a complete vendor-specific concept', async ({
  page,
}) => {
  await page.goto('/concepts?status=complete');
  await expect(page.getByRole('link', { name: 'Model-provider features' })).toBeVisible();
});
