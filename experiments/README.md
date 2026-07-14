# The AI Engineering Laboratory

A reproducible framework for studying how models behave — **education first, not
benchmarking**. Every experiment runs the *same* agent runtime the lessons teach
(`src/lib/agent/`) against scripted and (locally) real providers, recording only
**observable behavior**. Nothing here is part of the deployed public site; no API key
is ever required to build or view Agent Atlas.

## Run one

```bash
cp .env.example .env          # optional — add keys only for real-provider rows
npm run experiment -- experiments/definitions/004-failure-modes.ts
```

Writes `experiments/results/<id>/result.json` (structured data) and `report.md`
(the summary skeleton). Rows whose API key is missing are **skipped with a visible
reason** — so `001` and `004` run fully with zero keys today.

## Layout

```
experiments/
├── lib/            framework: types+schema, config (env→provider), tools, run, report, cli
├── definitions/    versioned experiment definitions (TypeScript, schema-validated)
└── results/        checked-in learning artifacts (result.json + report.md per experiment)
```

Provider adapters live in `src/lib/model/providers/` (Claude, OpenAI, Gemini, plus
`openAiCompatible()` for Qwen/Llama/Mistral/DeepSeek/local — same protocol, different
base URL). They map vendor shapes into the neutral `ModelProvider` interface; the
runtime never sees a vendor API.

## What every run measures

Outcome · success (machine-checked criteria) · model calls · stop reasons · tool
selection order · tool-call count · validation failures · malformed tool calls ·
adapter warnings · latency · input/output/total tokens · estimated cost (only when the
definition supplies pricing — always labeled `estimated`) · full execution trace.

Absent values stay absent — the framework never fabricates a number, and it never
records reasoning it cannot observe.

## Adding a provider

If it's OpenAI-compatible: add a `real` matrix row with
`provider: 'openai-compatible'`, a `providerName`, and a `baseUrlEnv`. Otherwise write
a ~100-line adapter in `src/lib/model/providers/` implementing `ModelProvider` and wire
it in `experiments/lib/config.ts`.

## Turning a result into a lesson

Experiments feed the knowledge-intake pipeline (`docs/INTAKE.md`): log the run as a
`sources` entry, decide what it updates, and propose lesson changes as a reviewable
diff. Evidence improves lessons; it never silently overwrites them. The two flagship
lessons (Tokens, Workflows vs agents) currently rely on *scripted* behavior explicitly
flagged as such — the first real runs are exactly what will replace those assumptions.

## Safety

Keys live only in git-ignored `.env` and never reach the browser or CI (ADR-0005).
The `raw` provider payload is used for adapter debugging only and is dropped before a
result is written. Tools remain the runtime allowlist; the calculator is a parser, and
`unreliable-lookup` is a deliberate always-fails tool for failure experiments.
