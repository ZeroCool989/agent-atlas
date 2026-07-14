# Experiment 005-live-claude-calculator (v1)

_Generated 2026-07-14T16:34:58.722Z by the Agent Atlas experiment framework (v1). Runtime: src/lib/agent (maxSteps 6); repeats: 3. This report records OBSERVABLE behavior only — no claims about internal reasoning._

## Summary

**Goal.** Prove the Phase 0/1 architecture (ModelProvider → runtime → tools → trace) works against a real provider, and measure repeatability at temperature 0.

## Question

Given a calculator tool, does Claude select and use it for arithmetic, and is that behavior consistent across three temperature-0 runs?

**Expected observation (pre-registered).** Claude selects the calculator, the runtime executes it, and the model reports 6,223. Runtime behavior is deterministic; token counts and latency vary with the model and network.

## Method

Every run executes through the identical agent runtime (`src/lib/agent/runner.ts`)
with the identical tool registry and validation. Only the matrix row (provider/model/
temperature) and prompt variant differ. Fresh provider instance per run; no shared
state. Success criteria are machine-checked and listed per run in `result.json`.

## Results

| provider · model · variant | success | outcomes | mean tool calls | mean latency (ms) | mean total tokens |
|---|---|---|---|---|---|
| scripted · scenario:calculator-tool-use · plain | 3/3 | completed | 1 | 800 | 203 |
| claude · claude-sonnet-4-5-20250929 · plain | 3/3 | completed | 1 | 3466 | 1392 |


## Observations (computed)

- scripted: 3/3 runs met all success criteria.
- claude: 3/3 runs met all success criteria.

## Limitations

- Scripted rows validate the framework, not model behavior — their results say nothing about real models.
- Sample sizes are small (3 repeat(s)); treat differences as observations to investigate, not conclusions.
- Latency includes network conditions at run time; costs are estimates from the definition's pricing table (absent = not computed).
- The runtime intentionally ends runs on invalid tool requests and tool failures (no retry) — retry behavior is out of scope until the reliability concept.

## Lessons Learned

_Curator: replace after reviewing the runs and traces. Starting points from the data:_
- scripted: 3/3 runs met all success criteria.
- claude: 3/3 runs met all success criteria.

## Future Questions

_Curator: what did this raise? Candidates: repeat with more samples; vary one factor the results made interesting; promote a finding into a lesson update via docs/INTAKE.md._
