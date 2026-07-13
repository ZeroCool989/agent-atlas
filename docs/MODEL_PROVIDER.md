# The Model Layer

`src/lib/model/` — the smallest transparent abstraction over "calling a model"
(ADR-0005). Plain TypeScript: no Astro, React, filesystem, UI, or SDK imports. Companion
to plan §8 (provider abstraction) and §18 (real-model experiment).

## Responsibility boundary

> **The model selects a tool. The agent runtime validates and executes it.**

The model layer represents model interaction only: what goes in (`ModelRequest`), what
comes out (`ModelResponse`), and how it can fail (typed `ModelError`s). It does **not**
execute tools, run the agent loop, decide retries, manage memory, perform RAG, apply
governance decisions, or render traces — those belong to `lib/agent/` (P1) and the UI
layers. In the scripted scenarios this shows up concretely: the provider returns a
`tool-call` response and then *waits*; the test (later, the agent runtime) executes the
tool and appends a `tool` message before calling `complete` again.

## The contract

```ts
interface ModelProvider {
  complete(request: ModelRequest): Promise<ModelResponse>;
}
```

**`ModelRequest`** — `system?` (separate field, not a message role: providers disagree
where system text goes, adapters map it) · `messages` (ordered, non-empty) · `tools?`
(definitions the model may select from). No generation settings yet — an intentional
limitation; see "Evolution" below.

**Messages** (provider-neutral, three roles):
- `user` — `{ role, text }`
- `assistant` — `{ role, text?, toolCalls? }` (what a model said: text, tool calls, or both)
- `tool` — `{ role, toolCallId, toolName, result, isError? }` — appended by the **agent
  runtime** after executing a tool; never produced by this layer.

**Tools** — `ToolDefinition { name, description, inputSchema }` (JSON Schema as plain
data) describes what a tool *is*; `ToolCall { id, toolName, arguments }` is the model's
*request* to use one. Argument validation against `inputSchema` and any policy checks
are the agent runtime's job.

**`ModelResponse`** — `text?` · `toolCalls` (zero or more) · `stopReason` · `usage` ·
`provider?`/`model?` · `raw?` (escape hatch for the raw vendor payload, adapter
debugging only — shared code must never read it).

**Stop reasons** (model-level only; vendor values are mapped by adapters):
`completed` · `tool-call` · `length` · `content-filter` · `error` · `unknown`.
Agent-level outcomes ("goal achieved", "needs human approval") are deliberately not in
this vocabulary.

**Usage metadata** — `latencyMs?`, `inputTokens?`, `outputTokens?`, `totalTokens?`,
`cost? { amount, currency, basis }`. Every field optional: a provider that doesn't
report a value leaves it `undefined` — nothing is fabricated. `cost.basis` distinguishes
`'declared'` (stated by the scenario/provider) from `'estimated'` (derived from a price
table — none exists yet; no live pricing in P0.4).

**Errors** — `ModelError { code, message, context }` with codes `invalid-request`,
`invalid-scenario`, `scenario-mismatch`, `scenario-exhausted`, `provider-failure`,
`timeout`, `malformed-response`, `unsupported-capability`. `ScenarioMismatchError`
additionally carries a structured `detail` (below). Context holds identifiers and
summaries, not full prompts or secrets. Failures are never converted into text responses.

## Scripted scenarios

Format decision (recorded in DECISIONS.md): **JSON files validated by a Zod schema at
load** (`parseScenario`). JSON is human-readable, git-diffable, importable by future
playground islands for visual playback, and schema validation catches drift the moment
a scenario is loaded. Scenarios live in `src/lib/model/scenarios/*.scenario.json`.

A scenario is `{ id, description, model?, turns[] }`; each turn is:

```jsonc
{
  "expect": {                      // all matchers optional; omitted expect = accept anything
    "roleSequence": ["user", "assistant", "tool"], // roles of ALL request messages, in order
    "lastMessageContains": "127",                  // substring of the last message's content
    "toolResultForCallId": "call-1",               // a tool result for this id must be present
    "toolsInclude": ["calculator"]                 // these tools must be offered
  },
  "respond": { "text": "...", "toolCalls": [...], "stopReason": "tool-call", "usage": {...} },
  "teaching": "Lesson annotation — ignored by the provider, rendered by lesson UIs."
}
```

That is the **entire matcher vocabulary** — four matchers, no matching language. They
check stable, educationally relevant properties (conversation shape, tool round-trip
correctness), never full-string prompt equality.

## ScriptedProvider semantics

- **Session = instance.** Turn position lives on the `ScriptedProvider` instance; a
  fresh replay is `new ScriptedProvider(scenario)`. No module-level state; interleaved
  sessions over one shared `Scenario` object are independent (tested). Consuming past
  the last turn throws `scenario-exhausted` with a remediation message rather than
  looping silently.
- **Divergence fails loudly.** Each matcher failure throws `ScenarioMismatchError` with
  `{ scenarioId, turnIndex, condition, expected, actual, remediation }`.
- **Determinism.** Responses, stop reasons, metadata, and mismatch behavior derive only
  from scenario data + the request. No clocks (`latencyMs` is declared, not measured),
  no randomness, no environment reads. If a timestamp is ever needed, inject a clock —
  never read ambient time. Responses are deep-cloned so consumer mutation can't corrupt
  later replays.

## Interface review against the three approved consumers

1. **Scripted scenarios** — replay the required five-step flow deterministically?
   **Yes**: the acceptance scenario (`calculator-tool-use`) exercises two model calls,
   a typed tool call, a tool-result message, distinct stop reasons, and declared
   metadata; repeated replays are value-identical (tested).
2. **Hand-built agent loop** — can a runtime inspect tool calls, execute externally,
   append observations, and call again? **Yes**: `response.toolCalls` is typed data;
   the runtime appends `assistant` and `tool` messages and re-calls `complete` — the
   acceptance test performs exactly this choreography manually.
3. **Local real-model experiment** — can a thin adapter map a real response into these
   types without leaking vendor structures? **Yes by construction**: messages/tools/
   stop reasons are provider-neutral; vendor payloads go behind `raw`; vendor stop
   reasons map into the six-value vocabulary; missing metadata stays `undefined`.

**Intentional limitations** (not defects; each awaits evidence from a real consumer):
no generation settings (temperature/maxTokens), no streaming, no multimodal input, no
parallel-tool-call semantics beyond "an array of calls", no prompt caching, no
reasoning-token fields, no capability negotiation. The real-model experiment is the
designated evidence source.

## Evolution

This interface is expected to change when evidence arrives — no permanence is claimed.
Changes must be evidence-driven (a named consumer needs it), backward-compatible where
reasonable (prefer optional fields), and recorded in DECISIONS.md or an ADR (per the
standing condition from the Phase 0 approval).
