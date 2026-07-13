/**
 * The tiny deterministic training corpus for the teaching tokenizer. Hand-written with
 * heavy, honest repetition so the first merges BPE discovers are recognizably
 * meaningful ("to", "en", "ing", pieces of "token") — the learner should be able to
 * predict some merges by eye before pressing play. Changing this text changes the
 * learned vocabulary; it is versioned content, not an implementation detail.
 *
 * Honesty note (repeated in the lesson): production tokenizers train on terabytes and
 * learn 50k–200k vocabulary entries; this corpus exists so a human can watch the SAME
 * algorithm work at a scale a human can follow.
 */
export const TRAINING_CORPUS = `
the tokenizer learns tokens from text
the model reads tokens not words
learning tokens means learning meaning
tokenization turns text into tokens
the meaning of a token is learned from text
a token is not a word and not a letter
the model learns the meaning of a token from tokens
`;

/** How many merges the teaching model learns — enough to see structure emerge. */
export const TEACHING_MERGES = 16;

/** The phrase the training visual re-tokenizes after every merge — chosen to show
 * both compression (" token", " learn" assemble piece by piece) and fragmentation
 * ("tokenization" keeps single-character shards around the rare "z"). */
export const SAMPLE_TEXT = 'the tokenizer learns tokenization';
