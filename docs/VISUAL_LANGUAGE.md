# Visual Language

The rules that make every Agent Atlas visualization read as one system (ADR-0004).
Code: pure scene layer in `src/lib/viz/`, renderers in `src/components/viz/`.

## Purpose

Visuals exist to make mechanisms inspectable — a token stream filling a context window,
later an agent loop executing. A visualization earns its place by showing *state a
learner could not see in prose*; it is never decoration. **When not to use one:** if
the concept is a definition, a judgment, or a comparison better served by a table or a
sentence, write the sentence.

## The load-bearing separation: scene truth vs rendering

```
Concept state → pure scene function → serializable scene data → React renderer → optional animation
```

- **Scene data describes what is TRUE at a step**: "token 3 is active", "window is at
  25%". Semantic state only — no CSS classes, colors, or durations.
- **The renderer decides how truth is displayed**: active → thicker border + "▸"
  marker + `--viz-active`.
- The pure layer (`src/lib/viz/`) has no React, Astro, browser APIs, timers, DOM, or
  animation imports; it is unit-tested without a browser.
- Every step is **independently renderable** — a complete scene, never animation
  deltas. Users scrub, reduced-motion users skip transitions, tests need stable state,
  static rendering needs a real first frame, and a transcript can reference "step 3"
  exactly. `clampStep` maps any out-of-range input to a valid scene.
- Scene functions are deterministic (no clocks, no randomness) and return fresh
  objects each call.

This separation is central to future agent-trace visuals: a trace will be scene data
derived from `ModelResponse`/tool-call values, rendered by the same discipline.

## State vocabulary

Currently justified by the roadmap (the P0.5 primitives use the subset marked •):

| State | Meaning | Non-color indicator |
|---|---|---|
| `inactive` • | exists, not yet involved | thin neutral border |
| `available` | could be chosen now | dashed border (reserved; first use: tool selection) |
| `active` • | being processed right now | thick border + "▸" marker |
| `processing` | long-running work (reserved) | progress affordance + text |
| `completed` • | done, part of the result | "✓" marker |
| `warning` • | near a limit / data inconsistency | "⚠" + explanatory text |
| `error` • | invalid state | error panel with the problem in words |

`human decision required` is anticipated for L5/governance visuals (approval gates) but
not yet implemented — add it when the first such visual lands.

## Motion vocabulary

| Motion | Communicates |
|---|---|
| `appear` | something new enters the explanation |
| `reveal` | detail that was always there becomes visible (boundaries, ids) |
| `flow` | information moving between components (direction = data direction) |
| `highlight` | attention, explicitly *without* implying movement or change |
| `replace` | one state becomes another (old truth is gone) |
| `accumulate` | quantity filling capacity (tokens → context window) |
| `compare` | two things shown against each other |
| `step` | discrete progression through a sequence |

## Motion rules

- Animation must communicate a state transition; if the scene truth didn't change,
  nothing moves.
- Identical transitions behave identically everywhere (`.viz-transition` is the single
  opt-in class).
- Movement direction has meaning — left→right is sequence/time; never animate in a
  direction that contradicts the data.
- Color is never the only channel: every state has a border/glyph/text indicator.
- Every frame is understandable when paused (scenes are complete states).
- Under `prefers-reduced-motion: reduce`, transitions are **removed, not slowed**
  (`global.css`); stepping stays fully functional because no information lives in the
  animation. Autoplay never starts by default.

## Color

Semantic CSS variables in `src/styles/global.css` — components never hard-code colors;
the palette is deliberately NOT final (placeholder slate/blue/emerald/amber/red values
with AA contrast on white):

`--viz-neutral · --viz-surface · --viz-boundary · --viz-active(-surface) ·
--viz-complete(-surface) · --viz-warning(-surface) · --viz-error(-surface)`

Avoid red/green-only distinctions: complete (green family) always pairs with "✓",
error (red family) with text.

## Static-first & hydration

- Every visualization server-renders its step-0 scene as real HTML — the page teaches
  before (and without) JavaScript. No empty shells awaiting hydration.
- Islands hydrate with **`client:visible`**: educational visuals sit inside prose and
  need interactivity only when scrolled into view; nothing about them justifies
  blocking-load hydration (`client:load`) and `client:idle` still pays for offscreen
  islands. Revisit per-component if a future visual is the page's primary content.
- Content-only pages ship zero JS — enforced by e2e tests (`smoke.spec.ts`,
  `viz-demo.spec.ts`).

## Accessibility rules

- Every visualization has a non-visual representation: headings, explanatory step text
  (the scene's `description`), and per-item `sr-only` state text (e.g. `token 5 of 7,
  " loss", entering the context window`). Never dump scene JSON into an ARIA label.
- Controls have accessible names; keyboard: ←/→ step, Home/End jump, Space/Enter on
  the focused control; focus stays visible (native buttons/range).
- Step changes announce via one concise polite live region ("Step 2 of 5: Token
  boundaries") — never per-element announcements, never aggressive autoplay chatter.
- Token lists are ordered lists; numbers in capacity views are real text (the bar
  itself is `aria-hidden` decoration).

## Current primitives

- **`Stepper`** — controlled step navigation (host owns `step`); play/pause/restart/
  scrub; stops at the end; manual navigation pauses; timers cleaned up; instances
  independent; exposes `data-reduced-motion` for styling hooks.
- **`TokenStream`** — renders `TokenView[]`; boundaries shown by chips + spacing +
  index labels (not color); leading spaces visible as `␣`; ids revealed by scene
  truth. Tokens ≠ words is the visual's core honesty claim. Not coupled to any
  tokenizer; P0.5 data is explicitly illustrative (real BPE arrives with the Tokens
  lesson).
- **`ContextWindowBar`** — conceptual finite-capacity view from `computeContextWindow`.
  Edge-case policy: impossible inputs → error panel (never a misleading bar); overflow
  → capped bar + "N tokens over" in words; segment/usage mismatches → visible warning.
  Captioned as conceptual: providers count and manage context differently.
