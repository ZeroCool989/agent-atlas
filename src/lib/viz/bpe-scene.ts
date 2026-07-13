/**
 * Step-scene function for the BPE training visual (Tokens lesson, Tier 2). Each step
 * answers one learning question: "what does the SAME text look like after the
 * tokenizer has learned k merges?" Step 0 is pure characters; step k re-encodes the
 * sample with only the first k merges — real encoding, not an animation script.
 *
 * Token states carry the teaching semantics: `active` = a token equal to the merge
 * just learned (watch it appear), `completed` = built by an earlier merge,
 * `inactive` = still a single character.
 */
import type { BpeModel } from '../sim/tokenizer';
import { encode } from '../sim/tokenizer';
import { clampStep } from './timeline';
import type { TokenView } from './types';

export interface BpeScene {
  step: number;
  totalSteps: number;
  title: string;
  /** Teaching text for the step; doubles as the accessible description. */
  description: string;
  sampleText: string;
  tokens: TokenView[];
  tokenCount: number;
  /** The merge learned at this step (absent at step 0). */
  merge?: { left: string; right: string; merged: string; frequency: number };
  mergesLearned: number;
}

const display = (s: string) => s.replace(/ /g, '␣');

export function createBpeScene(model: BpeModel, sampleText: string, step: number): BpeScene {
  const totalSteps = model.merges.length + 1;
  const current = clampStep(step, totalSteps);
  const merge = current > 0 ? model.merges[current - 1] : undefined;

  const encoded = encode(sampleText, model, { maxMerges: current });
  const tokens: TokenView[] = encoded.map((token, index) => ({
    index,
    text: token.text,
    ...(token.id !== undefined ? { id: token.id } : {}),
    state:
      merge && token.text === merge.merged
        ? 'active'
        : token.text.length > 1
          ? 'completed'
          : 'inactive',
  }));

  return {
    step: current,
    totalSteps,
    title: current === 0 ? 'Before any merges' : `Merge ${current} of ${model.merges.length}`,
    description:
      current === 0
        ? `The tokenizer starts with nothing but characters: ${encoded.length} single-character tokens. Every merge it learns from the corpus will make this segmentation coarser.`
        : `The corpus's most frequent remaining pair was "${display(merge!.left)}" + "${display(merge!.right)}" (seen ${merge!.frequency}×), so the tokenizer learned the new token "${display(merge!.merged)}". The sample now encodes to ${encoded.length} tokens.`,
    sampleText,
    tokens,
    tokenCount: encoded.length,
    ...(merge
      ? { merge: { left: merge.left, right: merge.right, merged: merge.merged, frequency: merge.frequency } }
      : {}),
    mergesLearned: current,
  };
}
