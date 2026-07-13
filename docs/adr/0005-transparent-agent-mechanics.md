# ADR-0005: Transparent Agent Mechanics in Plain TypeScript, with a Lightweight Model-Provider Abstraction

- **Status:** Accepted (2026-07-13)
- **Date:** 2026-07-13
- **Deciders:** Almir Dumisic, Claude (architect role)

## Context

Agent Atlas teaches how agents work from first principles. Two forces are in tension:

1. **Pedagogy demands transparency.** If the platform's own agent loop is a framework
   call (`LangGraph`, `CrewAI`, an Agents SDK), the mechanism the platform exists to
   teach is hidden inside a dependency. The learner (and the author) must be able to
   read every line between "the model returned a tool call" and "the tool ran."
2. **Honesty demands contact with reality.** Purely scripted simulations (ADR-0004) are
   deterministic and key-free, but they encode *assumptions* about model behavior. The
   author needs to observe real tool selection, malformed output, retries, latency,
   token counts, cost, hallucination risk, and stopping behavior at least once, early —
   or the scripted lessons risk teaching a sanitized fiction.

There is also a role-boundary question: Astro (ADR-0001) could tempt domain logic into
`.astro` components or framework-coupled code, which would make the mechanics both
untestable and unteachable.

## Decision

1. **Astro is the application shell and content platform only.** Routing, rendering,
   content collections, island hydration. No agent mechanics live in Astro components,
   islands, or framework-coupled modules.
2. **All agent mechanics are implemented transparently in plain TypeScript** under
   `src/lib/` (`lib/agent/` for the loop, tool registry, and workflow engines;
   `lib/model/` for providers): dependency-free, pure where possible, fully unit-tested,
   and written to be *read* — this code is itself course material and interview
   evidence (the L3 build project).
3. **A lightweight model-provider abstraction exists from day one.** A minimal
   `ModelProvider` interface — essentially `complete(request) => response` with typed
   tool-call support and per-call metadata (latency, input/output tokens, cost
   estimate) — with exactly two planned implementations:
   - `ScriptedProvider`: deterministic, replayable scenario files; the only provider
     the deployed site ever uses (ADR-0004).
   - A thin real-API provider used **only** by local scripts in `experiments/`
     (git-ignored `.env` key, never bundled by Astro, never needed in CI).
4. **One real-model agent experiment is scheduled early** — shortly after the
   foundational modules (agent loop + `ScriptedProvider`) exist in Phase 1. Same loop,
   real provider, 2–3 tool-use scenarios; transcripts checked in as `sources` entries
   and findings routed back into content via the intake pipeline.
5. **Agent frameworks are comparison subjects, not dependencies.** LangGraph, CrewAI,
   Agents SDKs, and similar are introduced only later (Phase 3,
   `framework-abstraction` layer content) and only *after* the underlying loop has been
   implemented manually — framed as "what the framework does for you, and what it
   hides." They never become load-bearing infrastructure for the platform.

## Rationale

- **The abstraction is deliberately minimal** — one interface, two implementations. It
  exists so that "scripted vs. real" is a constructor argument, not a rewrite. Anything
  more (middleware, streaming orchestration, provider routing) is speculative and would
  itself become the kind of hidden machinery the platform argues against.
- **The experiment is an intake source, not a feature.** Its output is knowledge
  (corrected scenarios, observed failure modes, real latency/cost numbers in lessons),
  not deployed functionality. This keeps ADR-0003 (no backend) and ADR-0004 (key-free
  deployed site) fully intact.
- **Hand-building before adopting** is the platform's own essentiality test applied to
  itself: a framework must earn its way in by demonstrating what the manual
  implementation lacks — the same judgment the curriculum teaches.

## Consequences

- `src/lib/agent/` and `src/lib/model/` are built in Phase 0–1 and carry full unit
  coverage; the flagship lesson ("direct call vs deterministic workflow vs tool-using
  agent") renders their actual execution traces.
- The real-API provider and `experiments/` scripts are excluded from the site bundle;
  CI verifies the build contains no reference to them and no key is required.
- Scripted scenarios gain a maintenance duty: when the real-model experiment (or any
  later run) contradicts a scripted behavior, the scenario is corrected via the intake
  pipeline — scripted content is a claim about reality, not a convenience.
- Revisit trigger: if a Phase 3 framework comparison reveals a capability that is both
  needed by the platform and disproportionately costly to maintain by hand, write a new
  ADR before adopting the framework as a dependency.
