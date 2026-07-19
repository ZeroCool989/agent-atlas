import { expect, test } from '@playwright/test';

/**
 * The three governance frameworks added to complete the matrix: DORA, ISO/IEC 42001,
 * FINMA. Each page must render its obligations table and its connected-concept links with
 * zero client JS, and all three must appear in the index and the mapping matrix.
 */

test('governance index lists the three new frameworks', async ({ page }) => {
  await page.goto('/governance');
  for (const name of ['DORA', 'ISO/IEC 42001', 'FINMA']) {
    await expect(page.getByRole('link', { name })).toBeVisible();
  }
});

const cases = [
  {
    slug: 'dora',
    heading: 'DORA',
    kind: 'regulation',
    obligation: /ICT risk-management framework/,
    concept: 'Observability',
    conceptHref: '/concepts/observability',
    ships: 'binding',
  },
  {
    slug: 'iso-42001',
    heading: 'ISO/IEC 42001',
    kind: 'standard',
    obligation: /AI policy and leadership/,
    concept: 'Evaluation',
    conceptHref: '/concepts/evaluation',
    ships: 'voluntary',
  },
  {
    slug: 'finma',
    heading: 'FINMA',
    kind: 'guidance',
    obligation: /Governance and clear accountability/,
    concept: 'Evaluation',
    conceptHref: '/concepts/evaluation',
    ships: 'mixed',
  },
] as const;

for (const c of cases) {
  test(`${c.heading} page renders obligations + concept links with zero JS`, async ({ page }) => {
    const scripts: string[] = [];
    page.on('request', (req) => {
      if (req.resourceType() === 'script') scripts.push(req.url());
    });

    await page.goto(`/governance/${c.slug}`);
    await expect(page.getByRole('heading', { level: 1, name: c.heading })).toBeVisible();
    await expect(page.getByText(/Who it binds:/)).toBeVisible();

    // Obligations table: a real requirement is present.
    await expect(page.getByRole('table').getByText(c.obligation)).toBeVisible();

    // Connected concepts link out to concept pages.
    await expect(
      page.locator('section[aria-label="Connected concepts"]').getByRole('link', { name: c.concept }),
    ).toHaveAttribute('href', c.conceptHref);

    expect(scripts).toEqual([]); // static framework page
  });
}

test('the matrix includes the three new frameworks as columns', async ({ page }) => {
  await page.goto('/governance/matrix');
  for (const name of ['DORA', 'ISO/IEC 42001', 'FINMA']) {
    await expect(
      page.getByRole('table').getByRole('columnheader').getByRole('link', { name, exact: true }),
    ).toHaveAttribute('href', `/governance/${name === 'ISO/IEC 42001' ? 'iso-42001' : name.toLowerCase()}`);
  }
});
