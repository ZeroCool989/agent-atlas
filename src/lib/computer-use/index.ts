/**
 * Computer use (GUI agents) — the perceive → decide → act loop over a mock screen, as a
 * dependency-free, unit-tested TypeScript toy (plan §3 L4, ADR-0005). Public surface:
 */
export {
  type Bounds,
  type Element,
  type ElementKind,
  type ElementRisk,
  type PerceivedElement,
  type Point,
  type Screen,
  type Screenshot,
  centerOf,
  contains,
  elementAt,
  elementById,
  screenshot,
} from './screen';
export {
  type Action,
  type ComputerUseEvent,
  type ComputerUseOptions,
  type ComputerUseResult,
  type Confirm,
  type Decision,
  type EventKind,
  type Outcome,
  type Policy,
  type World,
  DEFAULT_MAX_STEPS,
  actionLabel,
  actionPoint,
  runComputerUse,
} from './loop';
export {
  type ComputerUseDemoInput,
  COMPUTER_USE_DEMO_INPUT,
  DEMO_GOAL,
  buildDemoScreen,
  demoConfirm,
  demoPolicy,
  demoWorld,
} from './demo';
