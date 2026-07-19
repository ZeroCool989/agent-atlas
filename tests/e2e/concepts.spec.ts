import { expect, test } from '@playwright/test';

test.describe('concept index', () => {
  test('renders grouped by layer with accessible filters and word+glyph statuses', async ({ page }) => {
    await page.goto('/concepts');
    await expect(page.getByRole('heading', { level: 1, name: 'Concepts' })).toBeVisible();
    await expect(page.getByRole('heading', { level: 2, name: 'foundation' })).toBeVisible();
    await expect(page.getByRole('heading', { level: 2, name: 'core-mechanism' })).toBeVisible();
    // Accessible filter labels
    await expect(page.getByLabel('Essentiality layer')).toBeVisible();
    await expect(page.getByLabel('Status')).toBeVisible();
    // Status is words, not color alone
    const card = page.locator('li[data-status="stub"]').first();
    await expect(card).toContainText('stub');
  });

  test('layer filter narrows via shareable URL params', async ({ page }) => {
    await page.goto('/concepts?layer=core-mechanism');
    await expect(page.locator('li[data-layer="core-mechanism"]:visible')).toHaveCount(8); // + evaluation (stub)
    await expect(page.locator('li[data-layer="foundation"]:visible')).toHaveCount(0);
    await expect(page.getByRole('heading', { level: 2, name: 'foundation' })).toBeHidden();
  });

  test('status filter and combined filters work; form reflects the URL', async ({ page }) => {
    await page.goto('/concepts?status=complete');
    await expect(page.locator('li[data-status="complete"]:visible')).toHaveCount(13); // + rag, evaluation, failure-modes
    await expect(page.getByLabel('Status')).toHaveValue('complete');

    await page.goto('/concepts?layer=foundation&status=needs-update');
    const visible = page.locator('li[data-layer]:visible');
    await expect(visible).toHaveCount(1);
    await expect(visible).toContainText('Few-shot prompting');
  });

  test('empty filter result shows a clear empty state with a way out', async ({ page }) => {
    await page.goto('/concepts?layer=vendor-specific&status=complete');
    await expect(page.locator('#empty-state')).toBeVisible();
    await expect(page.locator('#empty-state')).toContainText('No concepts match');
    await expect(page.locator('#empty-state').getByRole('link')).toBeVisible();
  });

  test('without JavaScript the full unfiltered list still renders', async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto('/concepts?layer=core-mechanism'); // params inert without JS
    await expect(page.locator('li[data-layer]')).toHaveCount(15);
    await context.close();
  });
});

test.describe('concept pages', () => {
  test('complete page: verdict, canonical sections, relationships separated, governance, sources — zero JS', async ({ page }) => {
    const scripts: string[] = [];
    page.on('request', (req) => {
      if (req.resourceType() === 'script') scripts.push(req.url());
    });
    await page.goto('/concepts/context-windows');
    await expect(page.getByRole('heading', { level: 1, name: 'Context windows' })).toBeVisible();

    // Verdict box (restrained, no scores)
    const verdict = page.getByRole('complementary', { name: 'Essential or optional verdict' });
    await expect(verdict).toContainText('Essential — understanding this is non-negotiable.');
    await expect(verdict).toContainText('Simpler baseline');

    // Canonical sections render as headings
    await expect(page.getByRole('heading', { name: 'How does it work?' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'When should I avoid it?' })).toBeVisible();

    // Static (server-rendered) visualization present without hydration
    await expect(page.getByText('14500 of 16000 tokens used (90.6%)')).toBeVisible();

    // Relationships are semantically separated
    await expect(page.getByRole('heading', { name: 'Learn these first' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Related, not required' })).toBeVisible();
    // Prerequisite shows target status
    const prereqs = page.getByRole('heading', { name: 'Learn these first' }).locator('..');
    await expect(prereqs.getByRole('link', { name: 'Tokens' })).toBeVisible();
    await expect(prereqs).toContainText('complete'); // prerequisite shows target status

    // Governance: careful wording, linked framework
    const governance = page.locator('section[aria-label="Governance connections"]');
    await expect(governance).toContainText('Potential governance relevance');
    await expect(governance).toContainText('GDPR');
    await expect(governance).toContainText('depends on role, use case, jurisdiction');

    // Sources
    await expect(page.locator('section[aria-label="Sources"]').getByRole('link')).toContainText('Karpathy');

    // Interview disclosure: answers hidden until summary toggled
    const details = page.locator('details').first();
    const answer = details.locator('p');
    await expect(answer).toBeHidden();
    await details.locator('summary').click();
    await expect(answer).toBeVisible();

    expect(scripts).toEqual([]); // plain concept page with a static viz ships zero JS
  });

  test('stub page looks intentionally incomplete, not broken', async ({ page }) => {
    await page.goto('/concepts/memory');
    await expect(page.getByText(/This is a stub — planned territory/)).toBeVisible();
    await expect(page.getByRole('heading', { level: 1, name: 'Memory' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Tool calling' })).toBeVisible(); // still connected
  });

  test('needs-update page shows the review flag without invalidating the content', async ({ page }) => {
    await page.goto('/concepts/few-shot-prompting');
    const flag = page.getByRole('note', { name: 'Review flag' });
    await expect(flag).toContainText('Flagged for review');
    await expect(flag).toContainText('instruction-tuned models');
    await expect(flag).toContainText('remains structurally complete');
    // Explicit governance-not-applicable path renders its justification
    await expect(page.locator('section[aria-label="Governance connections"]')).toContainText(
      'No governance hooks declared, deliberately',
    );
  });

  test('the Tokens lesson: mental model, live BPE explorer, playground, misconceptions, honesty table', async ({ page }) => {
    const scripts: string[] = [];
    page.on('request', (req) => {
      if (req.resourceType() === 'script') scripts.push(req.url());
    });
    await page.goto('/concepts/tokens');

    // Mental model with its breaking point (honest-analogy rule)
    await expect(page.getByText(/Mental model: Lego bricks/)).toBeVisible();
    await expect(page.getByText(/Where the analogy breaks/)).toBeVisible();

    // The BPE training explorer is real and steppable: computed frequencies appear.
    const explorer = page.locator('section[aria-label="BPE training walkthrough"]');
    await expect(explorer.getByRole('heading', { name: 'Before any merges' })).toBeVisible();
    // client:visible below the fold — scroll it into view and wait for hydration
    // (Astro drops the `ssr` attribute from <astro-island> once hydrated).
    const island = page.locator('astro-island', { has: explorer });
    await island.scrollIntoViewIfNeeded();
    await expect(island).not.toHaveAttribute('ssr', /.*/);
    await explorer.getByRole('button', { name: 'Next' }).click();
    await expect(explorer.getByRole('heading', { name: /Merge 1 of 16/ })).toBeVisible();
    await expect(explorer.getByText(/seen 18×/).first()).toBeVisible(); // real corpus frequency

    // The playground tokenizes typed input live.
    const playground = page.locator('section[aria-label="Tokenizer playground"]');
    await playground.getByRole('textbox').fill('the model learns tokens');
    await expect(playground.getByText(/4 words → \d+ tokens/)).toBeVisible();

    // Misconceptions and honesty sections exist.
    await expect(page.getByRole('heading', { name: 'Common misconceptions' })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Teaching model vs production/ })).toBeVisible();
    await expect(page.getByText(/only its diet/)).toBeVisible();

    // Complete lesson with islands: hydrated JS present, but only island JS.
    expect(scripts.length).toBeGreaterThan(0);
  });

  test('unknown slug returns 404', async ({ page }) => {
    const response = await page.goto('/concepts/does-not-exist');
    expect(response!.status()).toBe(404);
  });

  test('accessibility basics: single h1, skip link, landmark main, details semantics', async ({ page }) => {
    await page.goto('/concepts/context-windows');
    await expect(page.locator('h1')).toHaveCount(1);
    await expect(page.locator('main#main')).toHaveCount(1);
    await page.keyboard.press('Tab');
    await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused();
    expect(await page.locator('details > summary').count()).toBeGreaterThan(0);
  });
});
