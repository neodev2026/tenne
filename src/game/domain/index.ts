/**
 * TENNE Combat Domain Layer (Headless & Engine-Independent)
 *
 * Rule AS-001: Gameplay and Rendering Separation
 * Rule AS-003: Rendering Cannot Define Gameplay Truth
 * Rule AS-004: Gameplay Logic Must Be Testable Without Browser
 * Rule AS-005: Deterministic Simulation Time & Chronological Progression
 * Rule AS-006: Canonical Event Precedence, Snapshot Isolation & Wave Execution
 * Rule GS-001: Orthogonal Posture and Weapon Action Axes
 * Rule GS-002: Squad Posture Intent and Transition Atomicity
 *
 * NOTE: T-011 implements deterministic simulation time, event categories,
 * event batching, and single-batch evaluation kernel. T-012 implements
 * Character Posture and Squad Posture Intent state transitions. Full combat
 * gameplay behaviors remain unimplemented (gameplayImplemented: false).
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

// ============================================================================
// Character Posture & Squad Posture Intent (GS-001, GS-002)
// ============================================================================

/**
 * Canonical Character Posture concepts (GS-001 §1).
 *
 * Posture is orthogonal to Weapon Action.
 * COVERED != RELOADING and EXPOSED != FIRING.
 */
export const CharacterPosture = {
  COVERED: 'COVERED',
  EXPOSED: 'EXPOSED',
  TRANSITIONING_TO_COVERED: 'TRANSITIONING_TO_COVERED',
  TRANSITIONING_TO_EXPOSED: 'TRANSITIONING_TO_EXPOSED',
} as const;

export type CharacterPosture = typeof CharacterPosture[keyof typeof CharacterPosture];

/**
 * [IMPLEMENTATION CHOICE] Stable-only posture alias used to enforce the T-012 initialization boundary.
 *
 * Restricts initialization to stable postures (COVERED or EXPOSED) and excludes active
 * transitional postures (TRANSITIONING_TO_COVERED, TRANSITIONING_TO_EXPOSED).
 *
 * Canonical values remain:
 * - COVERED
 * - EXPOSED
 * - TRANSITIONING_TO_COVERED
 * - TRANSITIONING_TO_EXPOSED
 *
 * The StableCharacterPosture alias is only an implementation-level subset and boundary utility,
 * not a canonical concept.
 */
export type StableCharacterPosture =
  | typeof CharacterPosture.COVERED
  | typeof CharacterPosture.EXPOSED;

export function isStableCharacterPosture(value: unknown): value is StableCharacterPosture {
  return (
    typeof value === 'string' &&
    (value === CharacterPosture.COVERED || value === CharacterPosture.EXPOSED)
  );
}

export function assertStableCharacterPosture(
  value: unknown,
  context = 'StableCharacterPosture'
): asserts value is StableCharacterPosture {
  if (!isStableCharacterPosture(value)) {
    throw new TypeError(
      `[${context}] Invalid stable character posture: expected one of ${CharacterPosture.COVERED}, ${CharacterPosture.EXPOSED}, received ${typeof value} (${String(value)})`
    );
  }
}

export function isCharacterPosture(value: unknown): value is CharacterPosture {
  return (
    typeof value === 'string' &&
    (value === CharacterPosture.COVERED ||
      value === CharacterPosture.EXPOSED ||
      value === CharacterPosture.TRANSITIONING_TO_COVERED ||
      value === CharacterPosture.TRANSITIONING_TO_EXPOSED)
  );
}

export function assertCharacterPosture(
  value: unknown,
  context = 'CharacterPosture'
): asserts value is CharacterPosture {
  if (!isCharacterPosture(value)) {
    throw new TypeError(
      `[${context}] Invalid character posture: expected one of ${Object.values(CharacterPosture).join(', ')}, received ${typeof value} (${String(value)})`
    );
  }
}

/**
 * Canonical Squad Posture Intent concepts (GS-002 §1).
 *
 * Squad-global tactical directive distinct from character-local actual posture.
 */
export const SquadPostureIntent = {
  WANT_COVERED: 'WANT_COVERED',
  WANT_EXPOSED: 'WANT_EXPOSED',
} as const;

export type SquadPostureIntent = typeof SquadPostureIntent[keyof typeof SquadPostureIntent];

export function isSquadPostureIntent(value: unknown): value is SquadPostureIntent {
  return (
    typeof value === 'string' &&
    (value === SquadPostureIntent.WANT_COVERED || value === SquadPostureIntent.WANT_EXPOSED)
  );
}

export function assertSquadPostureIntent(
  value: unknown,
  context = 'SquadPostureIntent'
): asserts value is SquadPostureIntent {
  if (!isSquadPostureIntent(value)) {
    throw new TypeError(
      `[${context}] Invalid squad posture intent: expected one of ${Object.values(SquadPostureIntent).join(', ')}, received ${typeof value} (${String(value)})`
    );
  }
}

/**
 * Internal nominal brand for CharacterPostureState.
 *
 * [IMPLEMENTATION CHOICE] Unexported unique symbol preventing ordinary typed callers
 * from bypassing transition authority via plain object literal construction.
 * Not an unapproved canonical gameplay concept.
 */
declare const characterPostureStateBrand: unique symbol;

/**
 * Character Posture State wrapper.
 *
 * [IMPLEMENTATION CHOICE] Encapsulates individual character posture with a nominal brand.
 * Ordinary typed external callers cannot construct arbitrary CharacterPostureState values
 * via plain object literals; within the T-012 implementation boundary, active transition
 * states are entered through beginIntentDrivenPostureTransition().
 *
 * Note: The nominal brand is a compile-time implementation boundary and does not represent
 * an unapproved gameplay concept, runtime framework complexity, or protection against
 * deliberate unsafe casts (such as `as unknown as`). The canonical truth is the transition
 * behavior and atomicity, not this function name or API shape.
 */
export interface CharacterPostureState {
  readonly posture: CharacterPosture;
  readonly [characterPostureStateBrand]: true;
}

/**
 * Internal factory creating branded CharacterPostureState values.
 * Strictly internal to this module; not exported.
 */
function createBrandedPostureState(posture: CharacterPosture): CharacterPostureState {
  return Object.freeze({
    posture,
  }) as unknown as CharacterPostureState;
}

/**
 * Squad Posture Intent State wrapper.
 * [IMPLEMENTATION CHOICE] Encapsulates global squad intent independently.
 * Does not model squad member arrays, 5-member container validation, formation slots,
 * or character identity.
 */
export interface SquadPostureIntentState {
  readonly intent: SquadPostureIntent;
}

// ============================================================================
// Explicit Initialization Factories (No Invented Defaults)
// ============================================================================

/**
 * Creates an initial CharacterPostureState requiring an explicit stable initial posture.
 *
 * Authority Boundary:
 * - Accepts strictly StableCharacterPosture (COVERED or EXPOSED).
 * - Rejects transitional postures (TRANSITIONING_TO_COVERED, TRANSITIONING_TO_EXPOSED).
 *   Within the T-012 implementation boundary, active transition states are entered through
 *   beginIntentDrivenPostureTransition().
 * - Does NOT invent COVERED or EXPOSED as a default.
 * - Caller must explicitly supply the initial stable posture.
 * - Does NOT define which stable posture combat canonically starts in.
 */
export function createInitialCharacterPostureState(
  initialPosture: StableCharacterPosture
): CharacterPostureState {
  assertStableCharacterPosture(initialPosture, 'createInitialCharacterPostureState');
  return createBrandedPostureState(initialPosture);
}

/**
 * Creates a SquadPostureIntentState requiring an explicit initial intent.
 * Canonical semantics does not define a universal initial intent (no default WANT_COVERED or WANT_EXPOSED).
 */
export function createSquadPostureIntentState(initialIntent: SquadPostureIntent): SquadPostureIntentState {
  assertSquadPostureIntent(initialIntent, 'createSquadPostureIntentState');
  return Object.freeze({
    intent: initialIntent,
  });
}

// ============================================================================
// State Operations & Invariant-Enforcing Transitions
// ============================================================================

/**
 * Updates Squad Posture Intent independently (GS-002 §1).
 *
 * Updating Squad Posture Intent does NOT mutate or cancel an ongoing character transition.
 */
export function updateSquadPostureIntent(
  currentState: SquadPostureIntentState,
  newIntent: SquadPostureIntent
): SquadPostureIntentState {
  assertSquadPostureIntent(newIntent, 'updateSquadPostureIntent');
  if (currentState.intent === newIntent) {
    return currentState;
  }
  return Object.freeze({
    intent: newIntent,
  });
}

/**
 * Pure query determining whether an intent-driven posture transition is applicable (GS-001, GS-002 §2).
 *
 * Applicable mappings for stable posture:
 * - COVERED + WANT_EXPOSED -> TRANSITIONING_TO_EXPOSED
 * - EXPOSED + WANT_COVERED -> TRANSITIONING_TO_COVERED
 * - COVERED + WANT_COVERED -> null (matches intent)
 * - EXPOSED + WANT_EXPOSED -> null (matches intent)
 *
 * For active transitions (TRANSITIONING_TO_COVERED, TRANSITIONING_TO_EXPOSED), returns null
 * (an ongoing transition cannot be replaced or restarted).
 *
 * NOTE: This is a posture-axis / squad-intent transform query only. It does NOT evaluate STUN,
 * future control restrictions, weapon restrictions, or global combat actionability.
 */
export function getApplicablePostureTransition(
  posture: CharacterPosture,
  intent: SquadPostureIntent
): 'TRANSITIONING_TO_COVERED' | 'TRANSITIONING_TO_EXPOSED' | null {
  assertCharacterPosture(posture, 'getApplicablePostureTransition');
  assertSquadPostureIntent(intent, 'getApplicablePostureTransition');

  if (posture === CharacterPosture.COVERED && intent === SquadPostureIntent.WANT_EXPOSED) {
    return CharacterPosture.TRANSITIONING_TO_EXPOSED;
  }

  if (posture === CharacterPosture.EXPOSED && intent === SquadPostureIntent.WANT_COVERED) {
    return CharacterPosture.TRANSITIONING_TO_COVERED;
  }

  return null;
}

/**
 * Begins an intent-driven posture transition derived strictly from current posture and Squad Intent (GS-002 §2).
 *
 * [IMPLEMENTATION CHOICE] Within the T-012 implementation boundary, active transition states
 * are entered through beginIntentDrivenPostureTransition(). The canonical truth is the transition
 * behavior and atomicity, not this function name or API shape.
 *
 * Authority Rules:
 * - COVERED + WANT_EXPOSED -> returns new state with TRANSITIONING_TO_EXPOSED
 * - EXPOSED + WANT_COVERED -> returns new state with TRANSITIONING_TO_COVERED
 * - COVERED + WANT_COVERED -> returns unchanged state (no new transition)
 * - EXPOSED + WANT_EXPOSED -> returns unchanged state (no new transition)
 * - TRANSITIONING_TO_COVERED -> returns unchanged state (active transition atomicity preserved)
 * - TRANSITIONING_TO_EXPOSED -> returns unchanged state (active transition atomicity preserved)
 *
 * IMPORTANT AUTHORITY BOUNDARY:
 * - Transition direction is derived strictly from (posture, squadIntent). The public API provides
 *   zero caller-selected target transition authority (no arbitrary transition escape hatch).
 * - This function is a POSTURE-AXIS / SQUAD-INTENT transform ONLY.
 * - It does NOT evaluate:
 *   - STUN or whether STUN prevents starting a new posture transition (unresolved under GAP-GS-005)
 *   - Future control restrictions
 *   - Weapon restrictions
 *   - Global combat actionability
 */
export function beginIntentDrivenPostureTransition(
  currentState: CharacterPostureState,
  squadIntent: SquadPostureIntent
): CharacterPostureState {
  assertCharacterPosture(currentState?.posture, 'beginIntentDrivenPostureTransition');
  assertSquadPostureIntent(squadIntent, 'beginIntentDrivenPostureTransition');

  // If already transitioning, preserve active transition without cancellation, reversal, or replacement
  if (
    currentState.posture === CharacterPosture.TRANSITIONING_TO_COVERED ||
    currentState.posture === CharacterPosture.TRANSITIONING_TO_EXPOSED
  ) {
    return currentState;
  }

  const applicable = getApplicablePostureTransition(currentState.posture, squadIntent);
  if (applicable === null) {
    return currentState;
  }

  return createBrandedPostureState(applicable);
}

/**
 * Result of completing an active posture transition.
 *
 * [IMPLEMENTATION CHOICE] Returns the committed destination state and reports whether
 * current Squad Intent warrants a subsequent transition without auto-executing it.
 */
export interface PostureTransitionCompletionResult {
  readonly state: CharacterPostureState;
  readonly nextApplicableTransition: 'TRANSITIONING_TO_COVERED' | 'TRANSITIONING_TO_EXPOSED' | null;
}

/**
 * Completes an active posture transition explicitly (GS-002 §2).
 *
 * Transitions:
 * - TRANSITIONING_TO_COVERED -> COVERED
 * - TRANSITIONING_TO_EXPOSED -> EXPOSED
 *
 * Post-Completion Reevaluation:
 * - Compares committed stable posture against latest Squad Posture Intent.
 * - If committed posture differs from intent (e.g. EXPOSED reached while intent is WANT_COVERED),
 *   reports the next applicable transition in `nextApplicableTransition`.
 * - IMPORTANT: Does NOT automatically begin that second transition inside the completion call.
 *
 * Throws TypeError/Error if currentState is already in a stable posture (COVERED or EXPOSED).
 * Decoupled from numerical elapsed time (no timers, frames, or browser scheduling).
 */
export function completeCharacterPostureTransition(
  currentState: CharacterPostureState,
  currentSquadIntent: SquadPostureIntent
): PostureTransitionCompletionResult {
  assertCharacterPosture(currentState?.posture, 'completeCharacterPostureTransition');
  assertSquadPostureIntent(currentSquadIntent, 'completeCharacterPostureTransition');

  if (currentState.posture === CharacterPosture.COVERED || currentState.posture === CharacterPosture.EXPOSED) {
    throw new Error(
      `[completeCharacterPostureTransition] Cannot complete transition: character is already in stable posture (${currentState.posture})`
    );
  }

  const destinationPosture: CharacterPosture =
    currentState.posture === CharacterPosture.TRANSITIONING_TO_COVERED
      ? CharacterPosture.COVERED
      : CharacterPosture.EXPOSED;

  const committedState: CharacterPostureState = createBrandedPostureState(destinationPosture);

  const nextApplicableTransition = getApplicablePostureTransition(destinationPosture, currentSquadIntent);

  return Object.freeze({
    state: committedState,
    nextApplicableTransition,
  });
}
