# Experiment 004-failure-modes (v1)

_Generated 2026-07-14T00:00:00.000Z by the Agent Atlas experiment framework (v1). Runtime: src/lib/agent (maxSteps 2); repeats: 1. This report records OBSERVABLE behavior only — no claims about internal reasoning._

## Summary

**Goal.** Demonstrate that every failure class resolves to an honest runtime outcome with an inspectable trace.

## Question

How does the runtime respond to an unknown tool, malformed arguments, a failing tool, and a runaway loop?

**Expected observation (pre-registered).** unknown tool → invalid-tool-request; bad arguments → invalid-tool-request; failing tool → tool-error; runaway loop → max-steps-reached. No crashes, no fabricated answers.

## Method

Every run executes through the identical agent runtime (`src/lib/agent/runner.ts`)
with the identical tool registry and validation. Only the matrix row (provider/model/
temperature) and prompt variant differ. Fresh provider instance per run; no shared
state. Success criteria are machine-checked and listed per run in `result.json`.

## Results

| provider · model · variant | success | outcomes | mean tool calls | mean latency (ms) | mean total tokens |
|---|---|---|---|---|---|
| scripted · scenario:failure-unknown-tool · provoke | 1/1 | invalid-tool-request | 1 | — | — |
| scripted · scenario:failure-bad-arguments · provoke | 1/1 | invalid-tool-request | 1 | — | — |
| scripted · scenario:failure-tool-exception · provoke | 1/1 | tool-error | 1 | — | — |
| scripted · scenario:failure-step-limit · provoke | 1/1 | max-steps-reached | 2 | — | — |


## Observations (computed)

- scripted: 4/4 runs met all success criteria.
- 2 run(s) had tool requests rejected by runtime validation.
- 1 run(s) hit the step limit.

## Limitations

- Scripted rows validate the framework, not model behavior — their results say nothing about real models.
- Sample sizes are small (1 repeat(s)); treat differences as observations to investigate, not conclusions.
- Latency includes network conditions at run time; costs are estimates from the definition's pricing table (absent = not computed).
- The runtime intentionally ends runs on invalid tool requests and tool failures (no retry) — retry behavior is out of scope until the reliability concept.

## Lessons Learned

_Curator: replace after reviewing the runs and traces. Starting points from the data:_
- scripted: 4/4 runs met all success criteria.
- 2 run(s) had tool requests rejected by runtime validation.
- 1 run(s) hit the step limit.

## Future Questions

_Curator: what did this raise? Candidates: repeat with more samples; vary one factor the results made interesting; promote a finding into a lesson update via docs/INTAKE.md._
