# Experiment 001-tool-use-baseline (v1)

_Generated 2026-07-14T00:00:00.000Z by the Agent Atlas experiment framework (v1). Runtime: src/lib/agent (maxSteps 6); repeats: 1. This report records OBSERVABLE behavior only — no claims about internal reasoning._

## Summary

**Goal.** Establish that the same runtime drives scripted and real providers, and capture baseline tool-use behavior on a task where a calculator is the correct move.

## Question

Given a calculator tool, does the model select and use it for arithmetic — and what does that cost in calls, tokens, and latency?

**Expected observation (pre-registered).** A capable model selects the calculator, the runtime executes it, and the model reports the exact result (6,223). The scripted row demonstrates this deterministically.

## Method

Every run executes through the identical agent runtime (`src/lib/agent/runner.ts`)
with the identical tool registry and validation. Only the matrix row (provider/model/
temperature) and prompt variant differ. Fresh provider instance per run; no shared
state. Success criteria are machine-checked and listed per run in `result.json`.

## Results

| provider · model · variant | success | outcomes | mean tool calls | mean latency (ms) | mean total tokens |
|---|---|---|---|---|---|
| scripted · scenario:calculator-tool-use · plain | 1/1 | completed | 1 | 800 | 203 |

Skipped rows: **claude** (missing ANTHROPIC_API_KEY in .env) · **openai** (missing OPENAI_API_KEY in .env) · **gemini** (missing GEMINI_API_KEY in .env)

## Observations (computed)

- scripted: 1/1 runs met all success criteria.
- 3 matrix row(s) skipped (missing keys).

## Limitations

- Scripted rows validate the framework, not model behavior — their results say nothing about real models.
- Sample sizes are small (1 repeat(s)); treat differences as observations to investigate, not conclusions.
- Latency includes network conditions at run time; costs are estimates from the definition's pricing table (absent = not computed).
- The runtime intentionally ends runs on invalid tool requests and tool failures (no retry) — retry behavior is out of scope until the reliability concept.

## Lessons Learned

_Curator: replace after reviewing the runs and traces. Starting points from the data:_
- scripted: 1/1 runs met all success criteria.
- 3 matrix row(s) skipped (missing keys).

## Future Questions

_Curator: what did this raise? Candidates: repeat with more samples; vary one factor the results made interesting; promote a finding into a lesson update via docs/INTAKE.md._
