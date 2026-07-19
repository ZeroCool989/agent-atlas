import { expect, test } from '@playwright/test';

test('governance index lists frameworks and ships zero client JS', async ({ page }) => {
  const scripts: string[] = [];
  page.on('request', (req) => {
    if (req.resourceType() === 'script') scripts.push(req.url());
  });

  await page.goto('/governance');
  await expect(page.getByRole('heading', { level: 1, name: 'Governance' })).toBeVisible();

  // Binding regulations and the voluntary frameworks/guidance all listed.
  for (const name of ['EU AI Act', 'GDPR', 'NIST AI RMF', 'OWASP LLM Top 10']) {
    await expect(page.getByRole('link', { name })).toBeVisible();
  }
  // Binding vs voluntary is surfaced, not hidden.
  await expect(page.getByText('binding').first()).toBeVisible();
  await expect(page.getByText('voluntary').first()).toBeVisible();

  expect(scripts).toEqual([]); // static governance index
});

test('a framework page shows obligations mapped to controls and links to its concepts', async ({
  page,
}) => {
  await page.goto('/governance/eu-ai-act');
  await expect(page.getByRole('heading', { level: 1, name: 'EU AI Act' })).toBeVisible();
  await expect(page.getByText(/Who it binds:/)).toBeVisible();

  // Obligations table: a requirement and its mapped control.
  const obligations = page.getByRole('table');
  await expect(obligations.getByText(/Accuracy, robustness/)).toBeVisible();
  await expect(obligations.getByText(/Evaluation, testing/)).toBeVisible();

  // Connected concepts link out (union of both directions — evaluation declares the ref).
  await expect(
    page.locator('section[aria-label="Connected concepts"]').getByRole('link', { name: 'Evaluation' }),
  ).toHaveAttribute('href', '/concepts/evaluation');
});

test('the mapping matrix renders the grid with bidirectional links', async ({ page }) => {
  await page.goto('/governance/matrix');
  await expect(page.getByRole('heading', { level: 1, name: /matrix/i })).toBeVisible();

  const table = page.getByRole('table');
  // Framework column headers link to framework pages (exact name — cell links also contain "GDPR").
  await expect(table.getByRole('columnheader').getByRole('link', { name: 'GDPR', exact: true })).toHaveAttribute(
    'href',
    '/governance/gdpr',
  );
  // Concept row headers link to concept pages.
  await expect(
    table.getByRole('rowheader').getByRole('link', { name: 'Embeddings', exact: true }),
  ).toHaveAttribute('href', '/concepts/embeddings');
  // A filled cell links to the framework (embeddings ● gdpr).
  await expect(
    table.getByRole('link', { name: 'Embeddings connects to GDPR' }),
  ).toHaveAttribute('href', '/governance/gdpr');
});

test('concept governance hook links to the framework, and the framework links back', async ({
  page,
}) => {
  // Concept → framework
  await page.goto('/concepts/embeddings');
  const hook = page
    .locator('section[aria-label="Governance connections"]')
    .getByRole('link', { name: 'GDPR' });
  await expect(hook).toHaveAttribute('href', '/governance/gdpr');

  // Framework → concept (the round trip)
  await page.goto('/governance/gdpr');
  await expect(
    page.locator('section[aria-label="Connected concepts"]').getByRole('link', { name: 'Embeddings' }),
  ).toHaveAttribute('href', '/concepts/embeddings');
});
