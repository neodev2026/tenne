/**
 * TENNE Combat Domain Layer (Headless & Engine-Independent)
 *
 * Rule AS-001: Gameplay and Rendering Separation
 * Rule AS-003: Rendering Cannot Define Gameplay Truth
 * Rule AS-004: Gameplay Logic Must Be Testable Without Browser
 * Rule AS-005: Deterministic Simulation Time & Chronological Progression
 * Rule AS-006: Canonical Event Precedence, Snapshot Isolation & Wave Execution
 *
 * NOTE: T-011 implements deterministic simulation time, event categories,
 * event batching, and single-batch evaluation kernel. T-009 combat gameplay
 * behaviors remain unimplemented (gameplayImplemented: false).
 */

// ============================================================================
// Bootstrap Metadata (Preserved for compatibility)
// ============================================================================

export interface DomainMetadata {
  layer: 'domain';
  deterministic: true;
  gameplayImplemented: false;
}

export function getDomainState(): DomainMetadata {
  return {
    layer: 'domain',
    deterministic: true,
    gameplayImplemented: false,
  };
}

// ============================================================================
// Readonly State View Boundary
// ============================================================================

/**
 * Compile-time recursive readonly view of domain state.
 *
 * [IMPLEMENTATION CHOICE] Provides a compile-time deep readonly contract preventing
 * normal typed mutation of nested properties without introducing a cloning framework,
 * structuredClone, or mutating the caller's state object via Object.freeze.
 */
export type DeepReadonly<T> =
  T extends (...args: never[]) => unknown ? T :
  T extends readonly (infer U)[] ? readonly DeepReadonly<U>[] :
  T extends object ? { readonly [K in keyof T]: DeepReadonly<T[K]> } :
  T;

// ============================================================================
// Simulation Time (AS-005 §1)
// ============================================================================

/**
 * Combat simulation time represented as an explicit integer.
 *
 * [IMPLEMENTATION CHOICE] Represented as a JavaScript number validated with Number.isSafeInteger().
 * The safe-integer range constraint is an implementation-safety choice, not canonical gameplay semantics.
 * In accordance with AS-005, simulation time does not restrict sign; negative safe integers are accepted.
 * Concrete time units (milliseconds, ticks, frames) remain deferred under GAP-AS-005.
 */
export type SimulationTime = number;

export function isSimulationTime(value: unknown): value is SimulationTime {
  return typeof value === 'number' && Number.isSafeInteger(value);
}

export function assertSimulationTime(value: unknown, context = 'SimulationTime'): asserts value is SimulationTime {
  if (!isSimulationTime(value)) {
    throw new TypeError(
      `[${context}] Invalid simulation time: expected safe integer, received ${typeof value} (${String(value)})`
    );
  }
}

// ============================================================================
// Canonical Event Categories (AS-006 §1)
// ============================================================================

/**
 * Exact 6-tier canonical category precedence hierarchy mandated by AS-006.
 *
 * Categories must not be reordered, collapsed, or augmented.
 * The order is semantic; the concrete string values are an implementation choice.
 */
export const EventCategory = {
  HARD_INTERRUPT_CONTROL: 'HARD_INTERRUPT_CONTROL',
  SCHEDULED_COMPLETION_STATE_TRANSITION: 'SCHEDULED_COMPLETION_STATE_TRANSITION',
  PLAYER_INPUT: 'PLAYER_INPUT',
  DERIVED_EVENTS: 'DERIVED_EVENTS',
  SKILL_TRIGGER_ACTIVATION: 'SKILL_TRIGGER_ACTIVATION',
  EFFECT_RESOLUTION: 'EFFECT_RESOLUTION',
} as const;

export type EventCategory = typeof EventCategory[keyof typeof EventCategory];

/**
 * Internal rank mapping for canonical category precedence comparator.
 * Lower rank indicates higher execution precedence (1 through 6).
 *
 * [IMPLEMENTATION CHOICE] This lookup is strictly internal to this module.
 * Numeric ranks are not exported or established as canonical domain data.
 */
const CATEGORY_PRECEDENCE_RANK: Readonly<Record<EventCategory, number>> = Object.freeze({
  [EventCategory.HARD_INTERRUPT_CONTROL]: 1,
  [EventCategory.SCHEDULED_COMPLETION_STATE_TRANSITION]: 2,
  [EventCategory.PLAYER_INPUT]: 3,
  [EventCategory.DERIVED_EVENTS]: 4,
  [EventCategory.SKILL_TRIGGER_ACTIVATION]: 5,
  [EventCategory.EFFECT_RESOLUTION]: 6,
});

function getCategoryPrecedenceRank(category: EventCategory): number {
  const rank = CATEGORY_PRECEDENCE_RANK[category];
  if (rank === undefined) {
    throw new Error(`[EventCategory] Unknown canonical event category: ${String(category)}`);
  }
  return rank;
}

// ============================================================================
// Domain Event & Event Batch (AS-005, AS-006 §1)
// ============================================================================

export interface DomainEvent<TPayload = unknown> {
  readonly timestamp: SimulationTime;
  readonly category: EventCategory;
  readonly type: string;
  readonly payload: TPayload;
}

/**
 * Sibling peer batch sharing exactly one timestamp and one category.
 *
 * [IMPLEMENTATION CHOICE] EventBatch is an implementation boundary construct
 * used by this kernel slice to group peer events cleanly. It is NOT canonically
 * declared identical to an Event Wave.
 *
 * Sibling peers within `events` have NO semantic ordering. Array indexing
 * does not represent priority or precedence.
 */
export interface EventBatch<TEvent extends DomainEvent = DomainEvent> {
  readonly timestamp: SimulationTime;
  readonly category: EventCategory;
  readonly events: readonly TEvent[];
}

/**
 * Partitions an arbitrary collection of DomainEvents into chronologically ordered category batches.
 *
 * Batches are ordered strictly by:
 * 1. Timestamp ascending (AS-005 §2)
 * 2. Canonical category precedence rank ascending (AS-006 §1)
 *
 * Sibling peer events sharing identical timestamp and category are collected into a single EventBatch.
 * Sibling peers carry no semantic ordering.
 */
export function groupEventsIntoBatches<E extends DomainEvent>(
  events: readonly E[]
): readonly EventBatch<E>[] {
  if (events.length === 0) {
    return Object.freeze([]);
  }

  // Validate timestamps and categories
  for (const event of events) {
    assertSimulationTime(event.timestamp, 'groupEventsIntoBatches');
    getCategoryPrecedenceRank(event.category);
  }

  // Group events by composite key: timestamp:category
  const batchMap = new Map<string, { timestamp: SimulationTime; category: EventCategory; events: E[] }>();

  for (const event of events) {
    const key = `${event.timestamp}:${event.category}`;
    let existing = batchMap.get(key);
    if (!existing) {
      existing = {
        timestamp: event.timestamp,
        category: event.category,
        events: [],
      };
      batchMap.set(key, existing);
    }
    existing.events.push(event);
  }

  // Sort batches strictly by:
  // 1. timestamp ascending
  // 2. category precedence rank ascending
  const sortedBatches = Array.from(batchMap.values()).sort((a, b) => {
    if (a.timestamp !== b.timestamp) {
      return a.timestamp < b.timestamp ? -1 : 1;
    }
    return getCategoryPrecedenceRank(a.category) - getCategoryPrecedenceRank(b.category);
  });

  return Object.freeze(
    sortedBatches.map((b) =>
      Object.freeze({
        timestamp: b.timestamp,
        category: b.category,
        events: Object.freeze([...b.events]),
      })
    )
  );
}

// ============================================================================
// Effect Intent (AS-006 §3)
// ============================================================================

/**
 * Staged effect intent structure for effect-producing logic.
 *
 * Effect Intents do not directly mutate shared state during evaluation.
 * Array order carries NO semantic priority; conflict resolution rules remain deferred under GAP-AS-006.
 */
export interface EffectIntent<TTarget = unknown, TEffect = unknown> {
  readonly target: TTarget;
  readonly effect: TEffect;
}

// ============================================================================
// Single-Batch Evaluation Kernel (AS-006 §2, §3, §4)
// ============================================================================

/**
 * Pure evaluator for individual sibling events in a batch.
 * Evaluates against a deep readonly view of the pre-batch state and emits staged Effect Intents.
 * Evaluators must not mutate shared state and do not emit canonical derived events.
 */
export type BatchEventEvaluator<TState, TEvent extends DomainEvent> = (
  snapshot: DeepReadonly<TState>,
  event: TEvent
) => readonly EffectIntent[];

/**
 * Pure post-evaluation resolution and atomic commit boundary.
 * Consumes a deep readonly view of the pre-batch state and all staged intents, producing the committed state.
 * Effect conflict resolution rules remain deferred under GAP-AS-006.
 */
export type BatchResolver<TState> = (
  preBatchSnapshot: DeepReadonly<TState>,
  stagedIntents: readonly EffectIntent[]
) => TState;

/**
 * Pure post-commit derived-event producer.
 * Invoked strictly after committedState exists to produce next-wave derived events.
 * Does NOT receive staged intents; derived events depend strictly on committed state.
 */
export type DerivedEventProducer<TState> = (
  committedState: DeepReadonly<TState>
) => readonly DomainEvent[];

export interface BatchExecutionInput<TState, TEvent extends DomainEvent> {
  readonly state: TState;
  readonly batch: EventBatch<TEvent>;
  readonly evaluator: BatchEventEvaluator<TState, TEvent>;
  readonly resolver: BatchResolver<TState>;
  readonly deriveEvents?: DerivedEventProducer<TState>;
}

export interface BatchExecutionResult<TState> {
  readonly committedState: TState;
  readonly stagedIntents: readonly EffectIntent[];
  readonly derivedEvents: readonly DomainEvent[];
}

/**
 * Executes evaluation and atomic commit for exactly ONE EventBatch.
 *
 * Guarantees:
 * 1. Single-batch boundary: consumes strictly one EventBatch.
 * 2. Pre-batch snapshot view: every peer in the batch receives the identical deep readonly pre-batch view.
 * 3. Isolated evaluation: evaluators do not observe staged intents of sibling peers.
 * 4. Atomic commit: resolver runs once after all peer evaluation is complete.
 * 5. Post-commit derived events: derived events are produced strictly after commit from committed state.
 * 6. No recursive execution: no automatic multi-batch sequencing or next-wave continuation.
 */
export function executeEventBatch<TState, TEvent extends DomainEvent>(
  input: BatchExecutionInput<TState, TEvent>
): BatchExecutionResult<TState> {
  const { state, batch, evaluator, resolver, deriveEvents } = input;

  // Validate batch boundaries
  assertSimulationTime(batch.timestamp, 'executeEventBatch');
  getCategoryPrecedenceRank(batch.category);

  // Enforce single-batch invariant: all events in batch must share identical timestamp and category
  for (const event of batch.events) {
    if (event.timestamp !== batch.timestamp || event.category !== batch.category) {
      throw new Error(
        `[executeEventBatch] Batch consistency violation: event (${event.timestamp}, ${event.category}) ` +
          `does not match batch boundary (${batch.timestamp}, ${batch.category})`
      );
    }
  }

  // Handle empty batch as deterministic no-op [IMPLEMENTATION CHOICE]
  if (batch.events.length === 0) {
    return Object.freeze({
      committedState: state,
      stagedIntents: Object.freeze([]),
      derivedEvents: Object.freeze([]),
    });
  }

  // 1. Snapshot Isolation: provide deep readonly view of pre-batch state without caller mutation
  const preBatchSnapshot = state as DeepReadonly<TState>;

  // 2. Peer Evaluation: evaluate each peer against the pre-batch snapshot view
  const stagedIntents: EffectIntent[] = [];
  for (const event of batch.events) {
    const emitted = evaluator(preBatchSnapshot, event);
    if (emitted && emitted.length > 0) {
      for (const intent of emitted) {
        stagedIntents.push(Object.freeze(intent));
      }
    }
  }

  const frozenStagedIntents = Object.freeze([...stagedIntents]);

  // 3. Post-Evaluation Atomic Commit: resolve and commit state atomically
  const committedState = resolver(preBatchSnapshot, frozenStagedIntents);

  // 4. Post-Commit Derived Events: generate derived events only after committedState exists
  let derivedEvents: readonly DomainEvent[] = Object.freeze([]);
  if (deriveEvents) {
    const rawDerived = deriveEvents(committedState as DeepReadonly<TState>);
    if (rawDerived && rawDerived.length > 0) {
      for (const derived of rawDerived) {
        assertSimulationTime(derived.timestamp, 'DerivedEventProducer');
        getCategoryPrecedenceRank(derived.category);
      }
      derivedEvents = Object.freeze([...rawDerived]);
    }
  }

  return Object.freeze({
    committedState,
    stagedIntents: frozenStagedIntents,
    derivedEvents,
  });
}
