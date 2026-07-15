# Experiment 007-live-direct-call (v1)

_Generated 2026-07-15T07:14:39.806Z by the Agent Atlas experiment framework (v1). Runtime: src/lib/agent (maxSteps 2); repeats: 2. This report records OBSERVABLE behavior only — no claims about internal reasoning._

## Summary

**Goal.** Measure whether a direct model call (no tools) answers arithmetic correctly, and how that degrades as the numbers grow — the evidence needed to reframe the flagship lesson honestly.

## Question

With no calculator available, does the model compute 127×49, a 4-digit product, and a 5-digit product correctly and consistently — or does weights-only arithmetic break down?

**Expected observation (pre-registered).** A capable model likely gets the small product right and becomes less reliable as digit count grows. The key teaching point is not "always wrong" but "unverifiable and not guaranteed": the direct-call architecture has nothing that could catch an error.

## Method

Every run executes through the identical agent runtime (`src/lib/agent/runner.ts`)
with the identical tool registry and validation. Only the matrix row (provider/model/
temperature) and prompt variant differ. Fresh provider instance per run; no shared
state. Success criteria are machine-checked and listed per run in `result.json`.

## Results

| provider · model · variant | success | outcomes | mean tool calls | mean latency (ms) | mean total tokens |
|---|---|---|---|---|---|
| claude · claude-sonnet-4-5-20250929 · small-127x49 | 2/2 | completed | 0 | 1392 | 32 |
| claude · claude-sonnet-4-5-20250929 · medium-4831x7692 | 2/2 | completed | 0 | 1066 | 35 |
| claude · claude-sonnet-4-5-20250929 · large-73948x61257 | 2/2 | completed | 0 | 1871 | 36 |


## Observations (computed)

- claude: 6/6 runs met all success criteria.
- Success by prompt variant: small-127x49 2/2, medium-4831x7692 2/2, large-73948x61257 2/2.

## Limitations

- Scripted rows validate the framework, not model behavior — their results say nothing about real models.
- Sample sizes are small (2 repeat(s)); treat differences as observations to investigate, not conclusions.
- Latency includes network conditions at run time; costs are estimates from the definition's pricing table (absent = not computed).
- The runtime intentionally ends runs on invalid tool requests and tool failures (no retry) — retry behavior is out of scope until the reliability concept.

## Lessons Learned

_Curator: replace after reviewing the runs and traces. Starting points from the data:_
- claude: 6/6 runs met all success criteria.
- Success by prompt variant: small-127x49 2/2, medium-4831x7692 2/2, large-73948x61257 2/2.

## Future Questions

_Curator: what did this raise? Candidates: repeat with more samples; vary one factor the results made interesting; promote a finding into a lesson update via docs/INTAKE.md._
