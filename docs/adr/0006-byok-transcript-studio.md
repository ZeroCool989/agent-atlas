# ADR-0006: Bring-Your-Own-Key Transcript Studio (opt-in browser model calls)

- **Status:** Accepted (2026-07-20)
- **Date:** 2026-07-20
- **Deciders:** Almir Dumisic, Claude (architect role)

## Context

Two learner requests: paste a transcript (e.g. from a YouTube lecture) and (a) get a
**good summary** and (b) turn it into **learning material** — quizzes, a study path,
flashcards. A good summary of arbitrary text is not something a deterministic engine can
produce; it needs a real language model.

This collides with ADR-0005 §3, which states the deployed site uses **only** the
`ScriptedProvider` — "no key ever reaches the browser." The collision is real and must be
resolved deliberately, not by quietly shipping a server key (which would break the
no-secrets posture, plan §15) nor by pretending an extractive summary is "good."

There is also a standing product constraint: **no ongoing hosting cost** (the site is
static on Vercel, free tier). A shared server-side key would bill the owner per visitor.

## Decision

Introduce a **Transcript Studio** at `/studio` with three explicitly-labelled modes, and
amend ADR-0005 §3 to permit real model calls **only** under the BYOK condition below.

1. **Demo mode (default, keyless).** A bundled sample transcript run through the existing
   `ScriptedProvider` and the real `runAgent` loop. The learner watches the agent's
   think → tool → observe → answer trace with **no key and no network** — ADR-0005's
   ScriptedProvider guarantee holds for the default experience, and this is what CI
   exercises.
2. **Study mode (keyless, no AI).** The learner's own pasted transcript, processed fully
   in-browser by the new deterministic engine (`src/lib/transcript/`): lexical matching
   against the Atlas's own concept corpus, an ordered learning path, and quizzes built
   from the matched concepts' existing interview questions and cloze items. $0, private,
   offline, honest about being extractive — no "good summary" claim, a study scaffold.
3. **Lab mode (BYOK).** The learner pastes **their own** API key (Anthropic or
   OpenAI-compatible). It is stored **only** in their browser (localStorage), the model is
   called **directly from the browser to the vendor**, and the same `runAgent` loop drives
   a real agent that summarizes the transcript and generates tailored material. The key
   never touches our server (there is no server). Usage bills the learner's own account.

### The amendment to ADR-0005 §3, stated precisely

The deployed site may execute a **real** `ModelProvider` **iff**: the credential is
supplied by the user at runtime, held client-side only, and the request goes browser →
vendor directly. **No credential is ever bundled, committed, stored server-side, or
required by CI.** `ScriptedProvider` remains the default and the only provider used by
every existing deterministic teaching demo. Lab mode is opt-in, visibly labelled, and
degrades to Study/Demo mode when no key is present.

## Consequences

- **`src/lib/transcript/`** (new): pure, dependency-free, fully unit-tested deterministic
  engine — this is the load-bearing new course material, and it means the feature is
  useful at $0 before any key is involved.
- **`src/lib/model/browser.ts`** (new): a thin BYOK factory over the existing
  `ClaudeProvider` / `OpenAIProvider` adapters (ADR-0005 §3's real adapters, until now
  used only by `experiments/`). Adds the `anthropic-dangerous-direct-browser-access`
  header Anthropic requires for direct browser calls. No new SDK.
- **CSP change (deliberate, documented):** `connect-src` gains `https://api.anthropic.com`
  and `https://api.openai.com` so Lab mode can reach the vendors. This is the one
  loosening of the strict `connect-src 'self'`; it is inert unless a user opts into Lab
  mode, and no other code path connects outward. Recorded here and in `DECISIONS.md`.
  A future refinement is a per-route CSP so only `/studio` carries the wider `connect-src`.
- **The transcript agent grounds itself in the Atlas.** One of its tools, `match_concepts`,
  is the deterministic matcher from Study mode — so even the LLM agent's "what does this
  cover" answer is anchored to the Atlas's real concept corpus, not free-associated. This
  is a teaching point, not an accident.
- **This is the visible "agent component."** Until now the hand-built runtime
  (`src/lib/agent/`, ADR-0005) existed as readable code but had no runnable surface in the
  UI. The Studio's live trace makes it something the learner can watch work.

## Alternatives considered

- **Server-side shared key (Vercel function).** Simplest UX, but recurring owner cost per
  visitor and a secret on the host — rejected on both the cost constraint and plan §15.
- **Deterministic-only (no AI ever).** Free and private, but cannot deliver the "good
  summary" that was the actual request. Kept as Study mode, not the whole answer.
- **Local model only (Ollama).** Valid and private, but requires the learner to run a
  server; folded into Lab mode later via the OpenAI-compatible `baseUrl` the adapter
  already supports, not a separate mode.
