import { expect, test } from '@playwright/test';

test('mcp lesson: mental model, steppable handshake viz hydrates, honest framing, governance, interview', async ({
  page,
}) => {
  await page.goto('/concepts/mcp');

  // Mental model with its breaking point.
  await expect(page.getByText(/Mental model: a universal power outlet/)).toBeVisible();
  await expect(page.getByText(/Where the analogy breaks/)).toBeVisible();

  // The honest load-bearing point: interoperability, not capability.
  await expect(
    page.getByText(/standardization and interoperability layer, not a model capability/),
  ).toBeVisible();

  // The Tier-2 handshake viz renders its server frame (step 0 title, nothing on the wire yet).
  await expect(page.getByTestId('mcp-title')).toHaveText('Two sides, one protocol');

  // The steppable island hydrates: advancing reveals real protocol steps.
  const stepper = page.getByRole('group', { name: 'MCP handshake steps' });
  await stepper.scrollIntoViewIfNeeded();
  // Wait for the client:visible island to hydrate before interacting (Astro drops the
  // `ssr` attribute from <astro-island> once hydrated) — clicking before hydration is a race.
  const island = page.locator('astro-island', { has: stepper });
  await expect(island).not.toHaveAttribute('ssr', /.*/);
  const next = stepper.getByRole('button', { name: 'Next' });
  await expect(next).toBeEnabled();

  // Step 1: the client connects (initialize).
  await next.click();
  await expect(page.getByTestId('mcp-title')).toHaveText('Client connects — initialize');

  // Step 2: discovery reveals the real tool manifest computed by the toy server.
  await next.click();
  await expect(page.getByTestId('mcp-discovered')).toContainText('search_docs');

  // Security section makes the trusted-code + data-egress point.
  await expect(page.getByText(/trusted third-party code you execute/)).toBeVisible();
  await expect(page.getByText(/Prompt injection through tool results/)).toBeVisible();

  // Interview package renders the critical-thinking question.
  await expect(
    page.getByText(/When is MCP worth it versus a direct integration/),
  ).toBeVisible();
});

test('mcp appears on the concepts index as a complete framework-abstraction concept', async ({
  page,
}) => {
  await page.goto('/concepts?status=complete');
  await expect(page.getByRole('link', { name: /Model Context Protocol/ })).toBeVisible();
});
