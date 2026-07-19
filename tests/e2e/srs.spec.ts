import { expect, test, type Page } from '@playwright/test';

// Mirrors the constants in src/lib/srs/backend.ts (own database, decoupled from history).
const SRS_DB_NAME = 'agent-atlas-srs';
const SRS_STORE = 'srs';
const SRS_KEY = 'srs';

const REVIEW = (page: Page) => page.locator('[data-srs]');

/** Wait for the review island to hydrate and finish loading its schedule. */
async function waitReady(page: Page) {
  const review = REVIEW(page);
  await review.scrollIntoViewIfNeeded();
  await expect(review).toHaveAttribute('data-srs-ready', 'true');
  return review;
}

/**
 * Seed the SRS IndexedDB with one card for `qid` that is already overdue, so the "due
 * today" queue has something deterministic to serve (a fresh browser is otherwise empty).
 */
async function seedDueCard(page: Page, qid: string) {
  await page.evaluate(
    ({ dbName, store, key, id }) => {
      const past = new Date(Date.now() - 3 * 86400000).toISOString();
      const state = {
        version: 1,
        cards: {
          [id]: {
            reps: 1,
            ease: 2.5,
            intervalDays: 1,
            due: past,
            lastGrade: 'good',
            lastReviewedAt: past,
          },
        },
      };
      return new Promise<void>((resolve, reject) => {
        const req = indexedDB.open(dbName, 1);
        req.onupgradeneeded = () => {
          if (!req.result.objectStoreNames.contains(store)) req.result.createObjectStore(store);
        };
        req.onerror = () => reject(req.error);
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction(store, 'readwrite');
          tx.objectStore(store).put(state, key);
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
      });
    },
    { dbName: SRS_DB_NAME, store: SRS_STORE, key: SRS_KEY, id: qid },
  );
}

test('due-today affordance shows an honest empty state on a fresh browser', async ({ page }) => {
  await page.goto('/interview');
  const review = await waitReady(page);
  // Nothing has been graded yet, so nothing is due — and we say so honestly.
  await expect(review).toHaveAttribute('data-due-count', '0');
  await expect(page.locator('[data-srs-empty]')).toBeVisible();
});

test('grading a due card empties the queue and the schedule persists across reload', async ({
  page,
}) => {
  await page.goto('/interview');
  await waitReady(page);

  // Take a real question id from the server-rendered list (no hard-coded ids).
  const qid = await page.locator('li[data-question]').first().getAttribute('data-question');
  expect(qid).toBeTruthy();

  // Seed one overdue card and reload so the island picks it up.
  await seedDueCard(page, qid!);
  await page.reload();
  const review = await waitReady(page);

  // The affordance now reports one due card.
  await expect(review).toHaveAttribute('data-due-count', '1');
  await expect(page.locator('[data-srs-due-label]')).toContainText('1 due for review');

  // Enter the review flow and confirm it serves the seeded question.
  await review.getByRole('button', { name: 'Start review' }).click();
  await expect(page.locator(`[data-review-question="${qid}"]`)).toBeVisible();

  // Grade it "Good" within the review flow (scoped so the drill's own Good buttons don't
  // collide): the card advances beyond today, so the queue drains to zero.
  await review.getByRole('group', { name: 'Grade this review' }).getByRole('button', { name: 'Good' }).click();
  // Wait for the durable IndexedDB write to complete before asserting/reloading.
  await expect(review).toHaveAttribute('data-srs-saved', /[1-9]/);
  await expect(page.locator('[data-srs-complete]')).toBeVisible();
  await expect(review).toHaveAttribute('data-due-count', '0');

  // Persistence: after a reload the card is still scheduled in the future (not due).
  await page.reload();
  const review2 = await waitReady(page);
  await expect(review2).toHaveAttribute('data-due-count', '0');
  await expect(page.locator('[data-srs-empty]')).toBeVisible();
});
