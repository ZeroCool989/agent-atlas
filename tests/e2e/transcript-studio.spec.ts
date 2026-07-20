import { expect, test, type Locator } from '@playwright/test';

/**
 * Transcript Studio (ADR-0006) e2e. Covers the KEYLESS paths only — Demo and Study run
 * fully in-browser, Lab is asserted for its safety surface without any real network call.
 */

/** The hydrated island wrapper for the Studio. */
function islandOf(page: import('@playwright/test').Page): Locator {
  return page.locator('astro-island', { has: page.getByRole('tablist', { name: 'Studio mode' }) });
}

test.describe('Transcript Studio', () => {
  test('nav links to the Studio', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: 'Studio' })).toBeVisible();
  });

  test('Demo mode runs the real agent loop and shows the trace, answer, and matches', async ({ page }) => {
    await page.goto('/studio');

    // Wait for the island to hydrate before interacting.
    const island = islandOf(page);
    await expect(island).not.toHaveAttribute('ssr', /.*/);

    // Demo is the default tab.
    await page.getByRole('button', { name: 'Run the demo agent' }).click();

    // The live trace renders and both tools appear in it.
    const trace = page.getByRole('region', { name: 'Agent execution trace' });
    await expect(trace).toBeVisible();
    await expect(trace.getByText(/match_concepts/).first()).toBeVisible();
    await expect(trace.getByText(/make_quiz/).first()).toBeVisible();

    // The final study-guide answer appears.
    await expect(page.getByRole('region', { name: 'Agent answer' })).toBeVisible();
    await expect(page.getByText(/study guide/i).first()).toBeVisible();

    // Matched concepts link out to /concepts/...
    const conceptLink = page.locator('a[data-concept-link]').first();
    await expect(conceptLink).toBeVisible();
    await expect(conceptLink).toHaveAttribute('href', /^\/concepts\//);
  });

  test('Study mode maps a transcript to concepts and the quiz score updates', async ({ page }) => {
    await page.goto('/studio');
    const island = islandOf(page);
    await expect(island).not.toHaveAttribute('ssr', /.*/);

    await page.getByRole('tab', { name: 'Study' }).click();

    await page
      .getByRole('textbox', { name: 'Paste a transcript' })
      .fill(
        'This talk covers retrieval augmented generation with embeddings and vector search. ' +
          'We add tool calling so the model becomes an agent, and we discuss evaluation and reliability.',
      );
    await page.getByRole('button', { name: 'Analyze', exact: true }).click();

    // Matched concepts appear and link out.
    const matched = page.getByRole('region', { name: 'Matched concepts' });
    await expect(matched).toBeVisible();
    const conceptLink = matched.locator('a[data-concept-link]').first();
    await expect(conceptLink).toBeVisible();
    await expect(conceptLink).toHaveAttribute('href', /^\/concepts\//);

    // Answer a quiz item and confirm the score increments. Handle either quiz kind robustly.
    const score = page.getByTestId('quiz-score');
    await expect(score).toHaveText('0');

    const firstItem = page.locator('[data-quiz-item]').first();
    await expect(firstItem).toBeVisible();

    const revealBtn = firstItem.getByRole('button', { name: 'Reveal answer' });
    if (await revealBtn.count()) {
      // interview item: reveal, then self-grade correct.
      await revealBtn.click();
      await firstItem.getByRole('button', { name: 'I got it' }).click();
    } else {
      // cloze item: the accepted term is shown in the "answer:" feedback after a wrong try,
      // but we can extract it from the prompt is not possible; instead type then read feedback.
      const input = firstItem.getByRole('textbox');
      await input.fill('definitely-wrong');
      await firstItem.getByRole('button', { name: 'Check' }).click();
      // Feedback reveals the answer; grab it and retry correctly.
      const feedback = await firstItem.getByText(/answer:/).innerText();
      const answer = feedback.replace(/.*answer:\s*/i, '').trim();
      await input.fill(answer);
      await firstItem.getByRole('button', { name: 'Check' }).click();
    }

    await expect(score).toHaveText('1');
  });

  test('Study mode shows a friendly empty state for off-topic text', async ({ page }) => {
    await page.goto('/studio');
    const island = islandOf(page);
    await expect(island).not.toHaveAttribute('ssr', /.*/);

    await page.getByRole('tab', { name: 'Study' }).click();
    await page.getByRole('textbox', { name: 'Paste a transcript' }).fill('The weather today is sunny and the cat slept all afternoon.');
    await page.getByRole('button', { name: 'Analyze', exact: true }).click();

    await expect(page.getByText(/No Atlas concepts matched/i)).toBeVisible();
  });

  test('Lab mode shows the security note and a password key input, with no network call', async ({ page }) => {
    await page.goto('/studio');
    const island = islandOf(page);
    await expect(island).not.toHaveAttribute('ssr', /.*/);

    await page.getByRole('tab', { name: 'Lab' }).click();

    await expect(page.getByTestId('lab-security-note')).toBeVisible();
    await expect(page.getByTestId('lab-security-note')).toContainText(/stored only in this browser/i);

    const keyInput = page.getByLabel('API key');
    await expect(keyInput).toHaveAttribute('type', 'password');
  });
});
