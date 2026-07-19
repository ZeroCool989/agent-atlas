/**
 * Prompt injection & LLM security — a dependency-free, unit-tested demonstrator of why an LLM
 * cannot reliably separate trusted instructions from untrusted data, and why the controls that
 * contain it are architectural and partial, never a prompt-level fix (plan §3 L5, §15; ADR-0005).
 * Public surface:
 */
export {
  type Consequence,
  type ControlName,
  type Controls,
  type Directive,
  type Phase,
  type ProposedCall,
  type Request,
  type RunResult,
  type SecurityEvent,
  type SecurityEventKind,
  type Segment,
  type ToolCall,
  type Trust,
  assemblePrompt,
  provenanceBlindReader,
  runMitigated,
  runNaive,
} from './pipeline';
export {
  type PromptInjectionScenario,
  type PromptInjectionScenarioInput,
  ALLOWED_TOOLS,
  DEMO_CONTROLS,
  DEMO_REQUEST,
  PROMPT_INJECTION_DEMO_INPUT,
  PROMPT_ONLY_DEFENSE_REQUEST,
  runPromptInjectionScenario,
} from './demo';
