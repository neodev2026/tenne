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
 * Rule GS-003: Firing Posture Invariant and Ammo-Depletion Auto-Cover
 * Rule GS-004: Cover-Triggered Reload, Cancellation and Resumption
 * Rule GS-005: STUN as Orthogonal Control State
 *
 * NOTE: T-011 implements deterministic simulation time, event categories,
 * event batching, and single-batch evaluation kernel. T-012 implements
 * Character Posture and Squad Posture Intent state transitions. T-013 implements
 * Weapon Action concepts and posture-side firing eligibility. T-014 implements
 * STUN status representation and STUN-specific firing blocker. T-017 implements
 * Weapon Action explicit domain state. T-019 implements canonical reload
 * cancellation domain state transitions (GS-004 §2). T-020 implements
 * Magazine Ammunition explicit domain state (GS-003 §2, AS-002). T-022 implements
 * WeaponAction IDLE baseline domain state and updates reload cancellation (GS-001 §2, GS-004 §2).
 * Full combat gameplay behaviors remain unimplemented (gameplayImplemented: false).
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

// ============================================================================
// Weapon Action Concepts & Posture Firing Prerequisite (GS-001 §2, GS-003 §1)
// ============================================================================

/**
 * Canonical Weapon Action values mandated by GS-001 §2:
 * - IDLE
 * - FIRING
 * - RELOADING
 *
 * Weapon Action is an independent state machine axis orthogonal to Character Posture.
 * COVERED != RELOADING and EXPOSED != FIRING.
 *
 * [SEMANTICALLY REQUIRED]: The three discrete values and their independent axis.
 * [IMPLEMENTATION CHOICE]: Representing these values via a TypeScript const object named WeaponAction.
 * Note: The TypeScript representation itself is an implementation choice, not canonical semantic truth.
 * Compile-time narrowing via `as const` does not provide runtime object freezing.
 */
export const WeaponAction = {
  IDLE: 'IDLE',
  FIRING: 'FIRING',
  RELOADING: 'RELOADING',
} as const;

/**
 * [IMPLEMENTATION CHOICE]: TypeScript union type derived from the const object.
 */
export type WeaponAction = typeof WeaponAction[keyof typeof WeaponAction];

/**
 * [IMPLEMENTATION CHOICE]: Pure runtime type guard validating canonical WeaponAction values.
 */
export function isWeaponAction(value: unknown): value is WeaponAction {
  return (
    typeof value === 'string' &&
    (value === WeaponAction.IDLE ||
      value === WeaponAction.FIRING ||
      value === WeaponAction.RELOADING)
  );
}

/**
 * [IMPLEMENTATION CHOICE]: Runtime assertion utility throwing TypeError on invalid WeaponAction values.
 */
export function assertWeaponAction(
  value: unknown,
  context = 'WeaponAction'
): asserts value is WeaponAction {
  if (!isWeaponAction(value)) {
    throw new TypeError(
      `[${context}] Invalid weapon action: expected one of ${Object.values(WeaponAction).join(', ')}, received ${typeof value} (${String(value)})`
    );
  }
}

/**
 * Weapon Action State wrapper (GS-001 §2).
 *
 * [IMPLEMENTATION CHOICE] Encapsulates individual character weapon action state.
 * Plain readonly data container consistent with SquadPostureIntentState.
 * Does not define transitions, ammo, reload lifecycle, or firing authority.
 */
export interface WeaponActionState {
  readonly action: WeaponAction;
}

/**
 * Creates a WeaponActionState requiring an explicit weapon action.
 *
 * Authority Boundary:
 * - Requires explicit canonical WeaponAction (IDLE, FIRING, RELOADING).
 * - Does NOT invent IDLE as a universal default.
 * - Reuses existing assertWeaponAction to enforce runtime validation.
 * - Returns an Object.freeze'd immutable state wrapper as an implementation choice.
 */
export function createWeaponActionState(action: WeaponAction): WeaponActionState {
  assertWeaponAction(action, 'createWeaponActionState');
  return Object.freeze({
    action,
  });
}

/**
 * Evaluates whether an individual character's posture satisfies the canonical
 * posture-side prerequisite for firing (GS-003 §1).
 *
 * [SEMANTICALLY REQUIRED]: GS-003 §1 mandates that weapon firing is strictly permitted
 * only when the character is fully EXPOSED, and prohibited while COVERED,
 * TRANSITIONING_TO_COVERED, or TRANSITIONING_TO_EXPOSED.
 *
 * [IMPLEMENTATION CHOICE]: Function naming `doesPostureSatisfyFiringPrerequisite`
 * explicitly answers only the posture prerequisite question.
 *
 * CRITICAL AUTHORITY BOUNDARY:
 * - Authoritative question: "Does this Character Posture satisfy the canonical posture prerequisite for firing?"
 * - Returns `true` ONLY for `CharacterPosture.EXPOSED`.
 * - Returns `false` for `COVERED`, `TRANSITIONING_TO_COVERED`, and `TRANSITIONING_TO_EXPOSED`.
 * - `true` must NOT mean actual FIRING begins, the character can globally fire, is globally
 *   eligible, is globally actionable, or that Weapon Action becomes FIRING.
 * - Actual firing remains subject to additional unmodeled/deferred axes such as weapon/ammunition
 *   state, control state, firing intent/input routing, and weapon-specific timing/cadence.
 *   This function neither evaluates nor defines their exact conjunction.
 */
export function doesPostureSatisfyFiringPrerequisite(posture: CharacterPosture): boolean {
  assertCharacterPosture(posture, 'doesPostureSatisfyFiringPrerequisite');
  return posture === CharacterPosture.EXPOSED;
}

// ============================================================================
// STUN Status & STUN-Specific Firing Blocker (GS-005 §1, §2, GS-009 §3)
// ============================================================================

/**
 * Validates that a value is a boolean primitive representing STUN status.
 *
 * [IMPLEMENTATION CHOICE] STUN is established as an independent crowd-control state
 * orthogonal to Posture (GS-005 §1). The repository does NOT canonically define a closed
 * Control State vocabulary (e.g. NORMAL, UNSTUNNED). STUN presence/absence is represented
 * via a primitive boolean flag (isStunned: boolean).
 */
export function isStunStatus(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

/**
 * Asserts that a value is a boolean primitive representing STUN status.
 */
export function assertStunStatus(value: unknown, context = 'doesStunBlockFiring'): asserts value is boolean {
  if (!isStunStatus(value)) {
    throw new TypeError(
      `[${context}] Invalid STUN status: expected boolean, received ${typeof value} (${String(value)})`
    );
  }
}

/**
 * Evaluates whether the presence of STUN blocks weapon firing (GS-005 §2, GS-009 §3).
 *
 * [SEMANTICALLY REQUIRED]:
 * - GS-005 §2 mandates that receiving STUN stops/interrupts active FIRING.
 * - GS-009 §3 mandates that actual firing remains prohibited whenever firing invariants
 *   (including non-stunned status under GS-005) are not satisfied.
 *
 * Behavior:
 * - isStunned === true => STUN blocks firing => returns true
 * - isStunned === false => STUN itself does not block firing => returns false
 *
 * CRITICAL AUTHORITY BOUNDARY:
 * - Authoritative question: "Does STUN itself block firing?"
 * - A return value of `true` means weapon firing is prohibited by the presence of STUN.
 * - A return value of `false` means strictly: "STUN itself does not block firing."
 * - A return value of `false` MUST NOT mean:
 *   - the character is actionable (GS-004 §1: "not stunned or control-restricted")
 *   - the character is globally eligible to fire
 *   - all control-side restrictions are absent
 *   - all firing prerequisites are satisfied
 *   - canFire is true
 *   - Weapon Action becomes FIRING
 *   - firing begins
 * - This function does NOT evaluate posture (GS-003 §1), weapon action (GS-001 §2),
 *   ammunition (GS-003 §2), input (GS-009), or cadence/timing (GAP-GS-002).
 * - Existing posture-side prerequisite query (doesPostureSatisfyFiringPrerequisite)
 *   and this STUN-specific blocker remain separate narrow facts.
 */
export function doesStunBlockFiring(isStunned: boolean): boolean {
  assertStunStatus(isStunned, 'doesStunBlockFiring');
  return isStunned;
}

// ============================================================================
// Reload Cancellation State Transitions (GS-004 §2)
// ============================================================================

/**
 * Cancels an active reload triggered by beginning transition from COVERED toward EXPOSED (GS-004 §2).
 *
 * [SEMANTICALLY REQUIRED] GS-004 §2 mandates that if a character begins transitioning
 * from COVERED toward EXPOSED (TRANSITIONING_TO_EXPOSED) while RELOADING:
 * 1. Reload is cancelled immediately.
 * 2. Weapon Action immediately transitions to IDLE.
 * 3. Incomplete reload progress is discarded (not preserved).
 * 4. Zero ammunition is granted to the magazine.
 *
 * [API PRECONDITION CONTRACT]:
 * - This function operates strictly as a transition operation for an active reload.
 * - If currentState.action !== WeaponAction.RELOADING, throws Error.
 * - This rejection is an API precondition / caller-contract decision, NOT a new canonical gameplay semantic.
 *
 * [IMPLEMENTATION / API BEHAVIOR]:
 * - If currentPosture !== CharacterPosture.TRANSITIONING_TO_EXPOSED, returns currentState unchanged.
 * - Returning the existing state reference unchanged is an implementation/API behavior only,
 *   NOT canonical gameplay semantics.
 * - When cancellation applies, returns a NEW WeaponActionState via createWeaponActionState(WeaponAction.IDLE).
 *   The existing WeaponActionState is never mutated, and no shared singleton state is introduced.
 *
 * CRITICAL AUTHORITY BOUNDARY (GS-004 §2):
 * - IDLE after reload cancellation denotes strictly that Weapon Action is no longer:
 *   - FIRING
 *   - RELOADING
 * - IDLE does NOT imply:
 *   - firing permission
 *   - ammunition availability
 *   - global actionability
 *   - absence of STUN
 *   - satisfaction of posture prerequisites
 * - Does NOT perform ammo mutation, reload progress tracking, reload timing, posture mutation,
 *   firing execution, firing interruption, or Auto-Fire reevaluation.
 */
export function cancelReloadOnPostureTransition(
  currentState: WeaponActionState,
  currentPosture: CharacterPosture
): WeaponActionState {
  assertWeaponAction(currentState?.action, 'cancelReloadOnPostureTransition');
  assertCharacterPosture(currentPosture, 'cancelReloadOnPostureTransition');

  if (currentState.action !== WeaponAction.RELOADING) {
    throw new Error(
      `[cancelReloadOnPostureTransition] Cannot cancel reload: character is not reloading (action: ${currentState.action})`
    );
  }

  if (currentPosture !== CharacterPosture.TRANSITIONING_TO_EXPOSED) {
    return currentState;
  }

  return createWeaponActionState(WeaponAction.IDLE);
}

/**
 * Cancels an active reload triggered by receiving STUN (GS-004 §2, GS-005 §2).
 *
 * [SEMANTICALLY REQUIRED] GS-004 §2 and GS-005 §2 mandate that if a character receives
 * STUN while RELOADING:
 * 1. Reload is cancelled immediately.
 * 2. Weapon Action immediately transitions to IDLE.
 * 3. Incomplete reload progress is discarded.
 * 4. Zero ammunition is granted.
 *
 * [API PRECONDITION CONTRACT]:
 * - This function operates strictly as a transition operation for an active reload.
 * - If currentState.action !== WeaponAction.RELOADING, throws Error.
 * - This rejection is an API precondition / caller-contract decision, NOT a new canonical gameplay semantic.
 *
 * [IMPLEMENTATION / API BEHAVIOR]:
 * - If isStunned === false, returns currentState unchanged.
 * - Returning the existing state reference unchanged is an implementation/API behavior only,
 *   NOT canonical gameplay semantics.
 * - When cancellation applies, returns a NEW WeaponActionState via createWeaponActionState(WeaponAction.IDLE).
 *   The existing WeaponActionState is never mutated, and no shared singleton state is introduced.
 *
 * CRITICAL AUTHORITY BOUNDARY (GS-004 §2):
 * - IDLE after reload cancellation denotes strictly that Weapon Action is no longer:
 *   - FIRING
 *   - RELOADING
 * - IDLE does NOT imply:
 *   - firing permission
 *   - ammunition availability
 *   - global actionability
 *   - absence of STUN
 *   - satisfaction of posture prerequisites
 * - Does NOT perform ammo mutation, reload progress tracking, reload timing, STUN duration handling,
 *   posture mutation, firing execution, firing interruption, or Auto-Fire reevaluation.
 */
export function cancelReloadOnStun(
  currentState: WeaponActionState,
  isStunned: boolean
): WeaponActionState {
  assertWeaponAction(currentState?.action, 'cancelReloadOnStun');
  assertStunStatus(isStunned, 'cancelReloadOnStun');

  if (currentState.action !== WeaponAction.RELOADING) {
    throw new Error(
      `[cancelReloadOnStun] Cannot cancel reload: character is not reloading (action: ${currentState.action})`
    );
  }

  if (!isStunned) {
    return currentState;
  }

  return createWeaponActionState(WeaponAction.IDLE);
}

// ============================================================================
// Magazine Ammunition State (GS-003 §2, AS-002)
// ============================================================================

/**
 * Magazine ammunition count represented as a non-negative safe integer.
 *
 * [SEMANTICALLY REQUIRED]:
 * - GS-003 §2 canonically establishes that magazine ammo reaches 0 when the final round is fired.
 * - GS-004 §2 establishes zero ammunition granted on reload cancellation.
 * - AS-001 and AS-002 establish that combat ammo state belongs in the deterministic Domain layer.
 *
 * [IMPLEMENTATION CHOICE / API CONTRACT]:
 * - Represented as a JavaScript number validated with Number.isSafeInteger() and value >= 0.
 * - Negative-value rejection (value >= 0) is a Human-approved API/data-safety precondition.
 *   It is NOT a newly declared canonical gameplay semantic.
 * - Ammo-consumption-per-shot mechanics and magazine capacities remain unresolved under GAP-GS-002
 *   and are intentionally unmodeled.
 * - Reserve ammunition and reload completion/replenishment remain unresolved under GAP-GS-003
 *   and are intentionally unmodeled.
 * - The domain does not yet canonically define structural ownership decomposition between
 *   character and weapon.
 */
export type MagazineAmmo = number;

export function isMagazineAmmo(value: unknown): value is MagazineAmmo {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

export function assertMagazineAmmo(
  value: unknown,
  context = 'MagazineAmmo'
): asserts value is MagazineAmmo {
  if (!isMagazineAmmo(value)) {
    throw new TypeError(
      `[${context}] Invalid magazine ammo: expected non-negative safe integer, received ${typeof value} (${String(value)})`
    );
  }
}

/**
 * Magazine Ammunition State wrapper.
 *
 * [IMPLEMENTATION CHOICE] Represents the current ammunition count for a magazine.
 * Plain readonly data container consistent with WeaponActionState and SquadPostureIntentState.
 * Does not model magazine capacity (GAP-GS-002), reserve ammunition (GAP-GS-003),
 * reload timing, firing consumption, ammo decrement, or ammo mutations.
 */
export interface MagazineAmmoState {
  readonly current: MagazineAmmo;
}

/**
 * Creates a MagazineAmmoState requiring an explicit caller-supplied ammo count.
 *
 * Authority Boundary:
 * - Requires explicit caller-supplied MagazineAmmo (non-negative safe integer).
 * - Does NOT invent a default initial ammo count (no default 0 or full).
 * - Validates input at runtime via assertMagazineAmmo.
 * - Returns an Object.freeze'd immutable state wrapper as an implementation choice.
 * - Does NOT introduce a singleton.
 */
export function createMagazineAmmoState(current: MagazineAmmo): MagazineAmmoState {
  assertMagazineAmmo(current, 'createMagazineAmmoState');
  return Object.freeze({
    current,
  });
}

