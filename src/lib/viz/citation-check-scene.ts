/**
 * The `(input, step) => Scene` function for the citation-check demo (ADR-0004, plan §8).
 * Pure and deterministic. Every per-sentence verdict is computed live by the L1
 * reliability build project (`src/lib/reliability/citation-check.ts`) — the same code the
 * lesson asks you to read — so the visual can never drift from the checker it teaches.
 *
 * The walkthrough reveals the checker's verdict one sentence at a time (supported /
 * fabricated citation / uncited claim), then a final step delivers the honest limit:
 * a sentence whose citation *resolves* is marked supported even though that source does
 * not actually back the claim. Detecting a fabricated citation is easy; verifying that a
 * real citation supports its claim is the hard, unsolved part.
 */
import { checkCitations, type SentenceStatus } from '../reliability/citation-check';
import { clampStep } from './timeline';

export interface CitationCheckSceneInput {
  /** A grounded answer whose sentences carry `[source-id]` citations. */
  answer: string;
  /** The source ids actually provided to the model (what a retriever returned). */
  providedSourceIds: string[];
  /** Index of the sentence the checker PASSES but that its source does not truly support. */
  subtleTrapIndex: number;
  /** One line explaining why the trap sentence is wrong despite a resolving citation. */
  subtleTrapNote: string;
}

export interface CitationCheckRow {
  sentence: string;
  citations: string[];
  /** 'unchecked' until this step reveals the verdict. */
  status: 'unchecked' | SentenceStatus;
  revealed: boolean;
  /** Marked on the limit step: resolved by the checker, yet not actually supported. */
  trapExposed: boolean;
}

export interface CitationCheckScene {
  step: number;
  totalSteps: number;
  title: string;
  description: string;
  rows: CitationCheckRow[];
  /** Number of sentences whose verdict is revealed so far. */
  checkedCount: number;
  /** Set on the final limit step. */
  limitNote?: string;
}

export function createCitationCheckScene(
  input: CitationCheckSceneInput,
  step: number,
): CitationCheckScene {
  const report = checkCitations(input.answer, input.providedSourceIds);
  const sentenceCount = report.sentences.length;
  // step 0 = answer shown, nothing checked; steps 1..N reveal each verdict; step N+1 = limit.
  const totalSteps = sentenceCount + 2;
  const current = clampStep(step, totalSteps);
  const isLimitStep = current === totalSteps - 1;
  const revealedThrough = isLimitStep ? sentenceCount : current; // limit step keeps all revealed

  const rows: CitationCheckRow[] = report.sentences.map((s, i) => {
    const revealed = i < revealedThrough;
    return {
      sentence: s.sentence,
      citations: s.citations,
      status: revealed ? s.status : 'unchecked',
      revealed,
      trapExposed: isLimitStep && i === input.subtleTrapIndex,
    };
  });

  let title: string;
  let description: string;
  if (current === 0) {
    title = 'A confident, grounded-looking answer';
    description =
      'Every sentence sounds authoritative and most carry a [source] tag. Fluency and citations are exactly what a hallucinated answer imitates, so we cannot trust it by reading — we have to check.';
  } else if (isLimitStep) {
    title = 'What the checker cannot catch';
    description = input.subtleTrapNote;
  } else {
    const checked = report.sentences[current - 1]!;
    const verdict =
      checked.status === 'supported'
        ? 'its citation resolves to a provided source'
        : checked.status === 'fabricated-citation'
          ? `it cites ${checked.fabricated.join(', ')}, which was never provided — a fabricated citation`
          : 'it asserts a fact with no citation at all';
    title = `Checking sentence ${current}`;
    description = `The detector reads the [ids] in this sentence and looks them up in the retrieved set: ${verdict}.`;
  }

  return {
    step: current,
    totalSteps,
    title,
    description,
    rows,
    checkedCount: Math.min(revealedThrough, sentenceCount),
    ...(isLimitStep ? { limitNote: input.subtleTrapNote } : {}),
  };
}

/**
 * Deterministic demo data. The answer is about the Eiffel Tower; `s2` (index 2) cites a
 * real provided source but makes a claim that source does not support — the trap. Only
 * the ids and the prose are teaching props; the checking is the real algorithm.
 */
export const CITATION_CHECK_DEMO_INPUT: CitationCheckSceneInput = {
  answer:
    'The Eiffel Tower opened to the public in 1889 [history]. ' +
    'It stands about 330 metres tall including antennas [specs]. ' +
    'It is repainted a uniform shade of sky blue every seven years [specs]. ' +
    'It briefly held the title of the tallest structure ever built [records-2020]. ' +
    'Roughly seven million people visit it each year.',
  providedSourceIds: ['history', 'specs'],
  subtleTrapIndex: 2,
  subtleTrapNote:
    'Sentence 3 cites “specs”, a real provided source, so the checker marks it supported — yet the tower is repainted in graduated shades of brown, not sky blue, and “specs” never mentions colour. A resolving citation is not a supporting one. Catching a made-up citation is easy string work; verifying that a real source actually backs the claim is the hard problem no simple check solves.',
};
