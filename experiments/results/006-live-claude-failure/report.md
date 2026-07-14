# Experiment 006-live-claude-failure (v1)

_Generated 2026-07-14T16:35:45.844Z by the Agent Atlas experiment framework (v1). Runtime: src/lib/agent (maxSteps 4); repeats: 1. This report records OBSERVABLE behavior only — no claims about internal reasoning._

## Summary

**Goal.** Observe how a real model reacts when a task invites a tool call the calculator cannot satisfy — and confirm the runtime bounds every reaction to an honest outcome.

## Question

Asked for a square root with only a +−×÷ calculator available, does the model emit an unparseable expression (→ tool-error), work around the limitation, or answer from weights?

**Expected observation (pre-registered).** One of: (a) the model calls the calculator with an expression like sqrt(2) or 2^0.5 that the parser rejects → runtime outcome tool-error; (b) the model rewrites the task into supported arithmetic; or (c) it answers ~1.414 from weights without the tool. All are safe and observable; none is pre-judged correct.

## Method

Every run executes through the identical agent runtime (`src/lib/agent/runner.ts`)
with the identical tool registry and validation. Only the matrix row (provider/model/
temperature) and prompt variant differ. Fresh provider instance per run; no shared
state. Success criteria are machine-checked and listed per run in `result.json`.

## Results

| provider · model · variant | success | outcomes | mean tool calls | mean latency (ms) | mean total tokens |
|---|---|---|---|---|---|
| claude · claude-sonnet-4-5-20250929 · sqrt | 0/1 | tool-error | 1 | 2517 | 701 |


## Observations (computed)

- claude: 0/1 runs met all success criteria.

## Limitations

- Scripted rows validate the framework, not model behavior — their results say nothing about real models.
- Sample sizes are small (1 repeat(s)); treat differences as observations to investigate, not conclusions.
- Latency includes network conditions at run time; costs are estimates from the definition's pricing table (absent = not computed).
- The runtime intentionally ends runs on invalid tool requests and tool failures (no retry) — retry behavior is out of scope until the reliability concept.

## Lessons Learned

_Curator: replace after reviewing the runs and traces. Starting points from the data:_
- claude: 0/1 runs met all success criteria.

## Future Questions

_Curator: what did this raise? Candidates: repeat with more samples; vary one factor the results made interesting; promote a finding into a lesson update via docs/INTAKE.md._
