# ADR-0004: Visualization & Simulation Stack

- **Status:** Accepted (2026-07-13, amended: model-provider abstraction behind simulations)
- **Date:** 2026-07-13

## Context

Visual learning is a core product requirement, not decoration. The platform needs, in
increasing order of cost: static diagrams, steppable/animated diagrams, and interactive
simulations (tokenizer, embedding space, RAG pipeline, agent loop). These must share one
visual language so the whole atlas reads as a single system, and they must stay
maintainable for years by effectively one person plus an AI collaborator.

## Options

1. **Mermaid everywhere** — cheap, text-based, renders in MDX; but generic-looking, weak
   layout control, no interactivity. Fine for throwaway sequence sketches only.
2. **Excalidraw/static images** — fast to draw, but unversionable as data, inconsistent,
   dead-ends for animation.
3. **Heavy animation library (Motion Canvas, Remotion, Manim-style)** — beautiful output,
   but a production pipeline per diagram; unsustainable at "every concept gets a visual."
4. **Custom React + SVG component library, D3 for layout math only, CSS/`motion` for
   animation** — a shared set of primitives (TokenStream, ContextWindowBar, PipelineFlow,
   SequenceDiagram, ExecutionGraph, LayerMap) that every lesson composes.

## Decision

**Option 4 as the system, with Mermaid permitted for low-stakes sequence/flow sketches in
draft content.** Specifically:

- A `src/components/viz/` library of typed React SVG primitives implementing one visual
  language (single palette, one node/edge grammar, one animation vocabulary:
  *appear, flow, highlight, step*).
- **D3 used as a math library** (force layout for the knowledge graph, scales, shape
  generators) — never for DOM manipulation; React owns the DOM.
- Step-based animation model: every animated diagram is a pure function
  `(step: number) => Scene`, driven by a shared `<Stepper>` control (play/pause/scrub).
  This makes animations testable and makes "scrub through the execution" a platform-wide
  interaction, not a per-diagram invention.
- **Simulations are deterministic by default.** The MVP tokenizer/RAG/agent-loop
  playgrounds run on real algorithms (actual BPE vocabulary, real cosine similarity, real
  precomputed embeddings shipped as static JSON) or clearly-labeled mock models — no API
  keys required to learn. Live-model (BYOK) mode *in the deployed site* is a later,
  separate decision with its own security review.
- **Amendment (at approval): determinism is an implementation choice behind an
  interface, not an architecture.** Engines that conceptually call a model consume the
  `ModelProvider` abstraction from `src/lib/model/` (ADR-0005). The deployed
  playgrounds use only the deterministic `ScriptedProvider`; the same engines run
  against a real provider in local `experiments/` scripts. Scripted scenarios are
  treated as *claims about real behavior* and are corrected when the real-model
  experiment contradicts them.
- Diagram *content* (nodes, edges, steps) is data (JSON/TS objects) separate from
  rendering, so Claude can generate/update diagrams as reviewable data diffs.

## Rationale

- The reusable-primitives approach is the only option whose **marginal cost per new
  visualization falls over time** — critical when the roadmap demands dozens of visuals.
- Pure-function scenes + data-driven diagrams fit the AI-collaborator workflow: updating a
  diagram is editing data, not re-drawing.
- Deterministic simulations teach mechanisms honestly (you can inspect *why* the retrieval
  ranked chunk 3 first) and keep the MVP free of key management, cost, and rate limits.

## Consequences

- Up-front investment: the primitive library and `<Stepper>` must be built in Phase 0–1
  before content velocity pays off (budgeted in the roadmap).
- 3D (React Three Fiber) is **deliberately excluded from MVP** — an embedding-space
  explorer works in 2D projection first; R3F is a Phase 3 option if 2D proves insufficient.
- Every visualization must render a static (non-hydrated) first frame so pages remain
  useful with JS disabled and cheap at first paint.
