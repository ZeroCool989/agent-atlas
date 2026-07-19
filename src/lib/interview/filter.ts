/**
 * Interview-bank filtering (plan §9). Pure, framework-free: given the question list and
 * an optional role/difficulty selection, return the matching subset in stable order.
 * Used by the /interview pages (server-side, static-first) and the drill island.
 */
import { INTERVIEW_ROLES, INTERVIEW_DIFFICULTIES } from '../content/model';
import type { InterviewRole, InterviewDifficulty } from '../content/model';

export interface FilterableQuestion {
  id: string;
  roles: readonly string[];
  difficulty: string;
}

export interface InterviewFilter {
  role?: string | null;
  difficulty?: string | null;
}

/** Narrow a raw query value to a valid role, else undefined (ignore junk params). */
export function parseRole(value: unknown): InterviewRole | undefined {
  return typeof value === 'string' && (INTERVIEW_ROLES as readonly string[]).includes(value)
    ? (value as InterviewRole)
    : undefined;
}

export function parseDifficulty(value: unknown): InterviewDifficulty | undefined {
  return typeof value === 'string' &&
    (INTERVIEW_DIFFICULTIES as readonly string[]).includes(value)
    ? (value as InterviewDifficulty)
    : undefined;
}

/**
 * Filter questions by role and/or difficulty. An unset (or invalid) facet does not
 * constrain. Order is preserved from the input, so callers control sort.
 */
export function filterQuestions<Q extends FilterableQuestion>(
  questions: readonly Q[],
  filter: InterviewFilter = {},
): Q[] {
  const role = parseRole(filter.role);
  const difficulty = parseDifficulty(filter.difficulty);
  return questions.filter((q) => {
    if (role && !q.roles.includes(role)) return false;
    if (difficulty && q.difficulty !== difficulty) return false;
    return true;
  });
}
