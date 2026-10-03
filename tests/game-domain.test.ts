import { describe, it, expect } from 'vitest';
import {
  getDomainState,
  isSimulationTime,
  assertSimulationTime,
  EventCategory,
  groupEventsIntoBatches,
  executeEventBatch,
  type DomainEvent,
  type EventBatch,
  type DeepReadonly,
  CharacterPosture,
  type StableCharacterPosture,
  isStableCharacterPosture,
  assertStableCharacterPosture,
  isCharacterPosture,
  assertCharacterPosture,
  SquadPostureIntent,
  isSquadPostureIntent,
  assertSquadPostureIntent,
  createInitialCharacterPostureState,
  createSquadPostureIntentState,
  updateSquadPostureIntent,
  getApplicablePostureTransition,
  beginIntentDrivenPostureTransition,
  completeCharacterPostureTransition,
  type CharacterPostureState,
  WeaponAction,
  isWeaponAction,
  assertWeaponAction,
  doesPostureSatisfyFiringPrerequisite,
  type WeaponActionState,
  createWeaponActionState,
  isStunStatus,
  assertStunStatus,
  doesStunBlockFiring,
  cancelReloadOnPostureTransition,
  cancelReloadOnStun,
  type MagazineAmmo,
  isMagazineAmmo,
  assertMagazineAmmo,
  type MagazineAmmoState,
  createMagazineAmmoState,
  type AmmoDepletionResponse,
  resolveAmmoDepletionResponse,
} from '../src/game/domain/index.ts';
import { getApplicationState } from '../src/game/application/index.ts';

describe('Game Architecture Isolation & Bootstrap Compatibility (AS-001, AS-004)', () => {
  it('domain state should be deterministic and retain gameplayImplemented: false', () => {
    const domain = getDomainState();
    expect(domain.layer).toBe('domain');
    expect(domain.deterministic).toBe(true);
    expect(domain.gameplayImplemented).toBe(false);
  });

  it('application state should initialize in bootstrap standby', () => {
    const app = getApplicationState();
    expect(app.layer).toBe('application');
    expect(app.status).toBe('BOOTSTRAP_STANDBY');
  });
});

describe('SimulationTime Runtime Representation & Validation (AS-005 §1)', () => {
  it('accepts zero and positive safe integers', () => {
    expect(isSimulationTime(0)).toBe(true);
    expect(isSimulationTime(1)).toBe(true);
    expect(isSimulationTime(1000)).toBe(true);
    expect(isSimulationTime(Number.MAX_SAFE_INTEGER)).toBe(true);
    expect(() => assertSimulationTime(0)).not.toThrow();
    expect(() => assertSimulationTime(Number.MAX_SAFE_INTEGER)).not.toThrow();
  });

  it('accepts negative safe integers (AS-005 does not restrict sign)', () => {
    expect(isSimulationTime(-1)).toBe(true);
    expect(isSimulationTime(-500)).toBe(true);
    expect(isSimulationTime(Number.MIN_SAFE_INTEGER)).toBe(true);
    expect(() => assertSimulationTime(-1)).not.toThrow();
    expect(() => assertSimulationTime(Number.MIN_SAFE_INTEGER)).not.toThrow();
  });

  it('rejects fractional / floating-point numbers', () => {
    expect(isSimulationTime(0.5)).toBe(false);
    expect(isSimulationTime(-1.25)).toBe(false);
    expect(isSimulationTime(Math.PI)).toBe(false);
    expect(() => assertSimulationTime(0.5)).toThrow(TypeError);
    expect(() => assertSimulationTime(-1.25)).toThrow(TypeError);
  });

  it('rejects non-safe integers (JavaScript implementation choice)', () => {
    expect(isSimulationTime(Number.MAX_SAFE_INTEGER + 1)).toBe(false);
    expect(isSimulationTime(Number.MIN_SAFE_INTEGER - 1)).toBe(false);
    expect(() => assertSimulationTime(Number.MAX_SAFE_INTEGER + 1)).toThrow(TypeError);
  });

  it('rejects NaN, Infinity, and -Infinity', () => {
    expect(isSimulationTime(Number.NaN)).toBe(false);
    expect(isSimulationTime(Number.POSITIVE_INFINITY)).toBe(false);
    expect(isSimulationTime(Number.NEGATIVE_INFINITY)).toBe(false);
    expect(() => assertSimulationTime(Number.NaN)).toThrow(TypeError);
    expect(() => assertSimulationTime(Number.POSITIVE_INFINITY)).toThrow(TypeError);
  });

  it('rejects non-number types at runtime', () => {
    expect(isSimulationTime('10')).toBe(false);
    expect(isSimulationTime(null)).toBe(false);
    expect(isSimulationTime(undefined)).toBe(false);
    expect(isSimulationTime({})).toBe(false);
    expect(isSimulationTime([])).toBe(false);
    expect(() => assertSimulationTime('10')).toThrow(TypeError);
  });
});

describe('Event Batching & Canonical Category Precedence (AS-005 §2, AS-006 §1)', () => {
  it('returns empty array when given zero events', () => {
    const batches = groupEventsIntoBatches([]);
    expect(batches).toHaveLength(0);
  });

  it('rejects unapproved or unknown categories during batching', () => {
    const invalidEvents: DomainEvent[] = [
      { timestamp: 10, category: 'UNKNOWN_CATEGORY' as unknown as EventCategory, type: 'TEST', payload: null },
    ];
    expect(() => groupEventsIntoBatches(invalidEvents)).toThrow(/Unknown canonical event category/);
  });

  it('partitions events across distinct timestamps into separate chronologically ordered batches', () => {
    const events: DomainEvent[] = [
      { timestamp: 50, category: EventCategory.PLAYER_INPUT, type: 'INPUT', payload: '50' },
      { timestamp: -10, category: EventCategory.PLAYER_INPUT, type: 'INPUT', payload: '-10' },
      { timestamp: 0, category: EventCategory.PLAYER_INPUT, type: 'INPUT', payload: '0' },
      { timestamp: 20, category: EventCategory.PLAYER_INPUT, type: 'INPUT', payload: '20' },
    ];

    const batches = groupEventsIntoBatches(events);
    expect(batches).toHaveLength(4);
    expect(batches[0].timestamp).toBe(-10);
    expect(batches[1].timestamp).toBe(0);
    expect(batches[2].timestamp).toBe(20);
    expect(batches[3].timestamp).toBe(50);
  });

  it('partitions events at the same timestamp across different categories into separate category batches ordered 1->6', () => {
    const t = 100;
    const events: DomainEvent[] = [
      { timestamp: t, category: EventCategory.EFFECT_RESOLUTION, type: 'EVENT', payload: 'cat-6' },
      { timestamp: t, category: EventCategory.PLAYER_INPUT, type: 'EVENT', payload: 'cat-3' },
      { timestamp: t, category: EventCategory.HARD_INTERRUPT_CONTROL, type: 'EVENT', payload: 'cat-1' },
      { timestamp: t, category: EventCategory.SKILL_TRIGGER_ACTIVATION, type: 'EVENT', payload: 'cat-5' },
      { timestamp: t, category: EventCategory.SCHEDULED_COMPLETION_STATE_TRANSITION, type: 'EVENT', payload: 'cat-2' },
      { timestamp: t, category: EventCategory.DERIVED_EVENTS, type: 'EVENT', payload: 'cat-4' },
    ];

    const batches = groupEventsIntoBatches(events);
    expect(batches).toHaveLength(6);
    expect(batches.map((b) => b.category)).toEqual([
      EventCategory.HARD_INTERRUPT_CONTROL,
      EventCategory.SCHEDULED_COMPLETION_STATE_TRANSITION,
      EventCategory.PLAYER_INPUT,
      EventCategory.DERIVED_EVENTS,
      EventCategory.SKILL_TRIGGER_ACTIVATION,
      EventCategory.EFFECT_RESOLUTION,
    ]);
  });

  it('ensures chronological timestamp ordering dominates category precedence', () => {
    const events: DomainEvent[] = [
      { timestamp: 2, category: EventCategory.HARD_INTERRUPT_CONTROL, type: 'EVENT', payload: 't2-c1' },
      { timestamp: 1, category: EventCategory.EFFECT_RESOLUTION, type: 'EVENT', payload: 't1-c6' },
    ];

    const batches = groupEventsIntoBatches(events);
    expect(batches).toHaveLength(2);
    expect(batches[0].timestamp).toBe(1);
    expect(batches[0].category).toBe(EventCategory.EFFECT_RESOLUTION);
    expect(batches[1].timestamp).toBe(2);
    expect(batches[1].category).toBe(EventCategory.HARD_INTERRUPT_CONTROL);
  });

  it('groups sibling events sharing identical timestamp and category into one EventBatch retaining all peers', () => {
    const events: DomainEvent<{ id: string }>[] = [
      { timestamp: 42, category: EventCategory.PLAYER_INPUT, type: 'ACTION_A', payload: { id: 'peer-A' } },
      { timestamp: 42, category: EventCategory.PLAYER_INPUT, type: 'ACTION_B', payload: { id: 'peer-B' } },
      { timestamp: 42, category: EventCategory.PLAYER_INPUT, type: 'ACTION_C', payload: { id: 'peer-C' } },
    ];

    const batches = groupEventsIntoBatches(events);
    expect(batches).toHaveLength(1);
    expect(batches[0].timestamp).toBe(42);
    expect(batches[0].category).toBe(EventCategory.PLAYER_INPUT);
    expect(batches[0].events).toHaveLength(3);

    // Verify all peers are retained without asserting semantic priority on their order
    const peerIds = new Set(batches[0].events.map((e) => e.payload.id));
    expect(peerIds.has('peer-A')).toBe(true);
    expect(peerIds.has('peer-B')).toBe(true);
    expect(peerIds.has('peer-C')).toBe(true);
  });
});

describe('Single-Batch Evaluation Kernel (AS-006 §2, §3, §4)', () => {
  interface TestState {
    readonly counter: number;
    readonly markers: readonly string[];
    readonly config: {
      readonly mode: string;
    };
  }

  it('handles empty EventBatch as a deterministic no-op (IMPLEMENTATION CHOICE)', () => {
    const initialState: TestState = {
      counter: 10,
      markers: ['INITIAL'],
      config: { mode: 'STANDARD' },
    };
    const emptyBatch: EventBatch = {
      timestamp: 10,
      category: EventCategory.PLAYER_INPUT,
      events: [],
    };

    const result = executeEventBatch({
      state: initialState,
      batch: emptyBatch,
      evaluator: () => [],
      resolver: (snapshot) => snapshot,
    });

    expect(result.committedState).toEqual(initialState);
    expect(result.stagedIntents).toHaveLength(0);
    expect(result.derivedEvents).toHaveLength(0);
  });

  it('enforces single-batch boundary by rejecting events with mismatched timestamp or category', () => {
    const initialState: TestState = { counter: 0, markers: [], config: { mode: 'TEST' } };
    const invalidBatch: EventBatch = {
      timestamp: 10,
      category: EventCategory.PLAYER_INPUT,
      events: [
        { timestamp: 10, category: EventCategory.PLAYER_INPUT, type: 'A', payload: null },
        { timestamp: 20, category: EventCategory.PLAYER_INPUT, type: 'B', payload: null }, // Mismatched timestamp
      ],
    };

    expect(() =>
      executeEventBatch({
        state: initialState,
        batch: invalidBatch,
        evaluator: () => [],
        resolver: (s) => s,
      })
    ).toThrow(/Batch consistency violation/);
  });

  it('provides compile-time deep readonly snapshot view to peer evaluators without mutating caller object', () => {
    const initialState: TestState = {
      counter: 100,
      markers: ['MARKER_1'],
      config: { mode: 'INITIAL_MODE' },
    };
    const observedSnapshots: DeepReadonly<TestState>[] = [];

    const batch: EventBatch<DomainEvent<string>> = {
      timestamp: 5,
      category: EventCategory.SKILL_TRIGGER_ACTIVATION,
      events: [
        { timestamp: 5, category: EventCategory.SKILL_TRIGGER_ACTIVATION, type: 'TRIGGER', payload: 'payload-1' },
        { timestamp: 5, category: EventCategory.SKILL_TRIGGER_ACTIVATION, type: 'TRIGGER', payload: 'payload-2' },
      ],
    };

    executeEventBatch({
      state: initialState,
      batch,
      evaluator: (snapshot, event) => {
        observedSnapshots.push(snapshot);
        return [{ target: 'counter', effect: event.payload }];
      },
      resolver: (snapshot) => snapshot,
    });

    expect(observedSnapshots).toHaveLength(2);
    // All peers receive identical view of the pre-batch state
    expect(observedSnapshots[0].counter).toBe(100);
    expect(observedSnapshots[0].config.mode).toBe('INITIAL_MODE');
    expect(observedSnapshots[1].counter).toBe(100);
    expect(observedSnapshots[1].config.mode).toBe('INITIAL_MODE');

    // Caller object was not frozen or mutated
    expect(Object.isFrozen(initialState)).toBe(false);
  });

  it('stages Effect Intents during evaluation without shared-state mutation, and commits them in atomic step', () => {
    const initialState: TestState = { counter: 10, markers: [], config: { mode: 'IDLE' } };
    let resolverCallCount = 0;

    const batch: EventBatch<DomainEvent<number>> = {
      timestamp: 10,
      category: EventCategory.EFFECT_RESOLUTION,
      events: [
        { timestamp: 10, category: EventCategory.EFFECT_RESOLUTION, type: 'APPLY_DELTA', payload: 15 },
        { timestamp: 10, category: EventCategory.EFFECT_RESOLUTION, type: 'APPLY_DELTA', payload: 25 },
      ],
    };

    const result = executeEventBatch({
      state: initialState,
      batch,
      evaluator: (_snapshot, event) => {
        // Pure evaluation emitting staged intent; domain state remains unmutated
        return [{ target: 'INCREMENT', effect: event.payload }];
      },
      resolver: (preBatchSnapshot, stagedIntents) => {
        resolverCallCount++;
        // Pure atomic commit of non-conflicting test intents
        let nextCounter = preBatchSnapshot.counter;
        const nextMarkers = [...preBatchSnapshot.markers];

        for (const intent of stagedIntents) {
          if (intent.target === 'INCREMENT') {
            nextCounter += intent.effect as number;
            nextMarkers.push(`APPLIED_${intent.effect}`);
          }
        }

        return {
          counter: nextCounter,
          markers: nextMarkers,
          config: { mode: 'UPDATED' },
        };
      },
    });

    expect(resolverCallCount).toBe(1);
    expect(result.stagedIntents).toHaveLength(2);
    expect(result.committedState.counter).toBe(50);
    expect(result.committedState.markers).toContain('APPLIED_15');
    expect(result.committedState.markers).toContain('APPLIED_25');
    expect(result.committedState.config.mode).toBe('UPDATED');
  });

  it('produces derived events strictly post-commit from committedState without stagedIntents dependency', () => {
    const initialState: TestState = { counter: 0, markers: [], config: { mode: 'STANDBY' } };

    const batch: EventBatch<DomainEvent<number>> = {
      timestamp: 30,
      category: EventCategory.EFFECT_RESOLUTION,
      events: [
        { timestamp: 30, category: EventCategory.EFFECT_RESOLUTION, type: 'STEP', payload: 1 },
      ],
    };

    let observedStateInDerivedProducer: DeepReadonly<TestState> | null = null;

    const result = executeEventBatch({
      state: initialState,
      batch,
      evaluator: (_snapshot, event) => [{ target: 'STEP', effect: event.payload }],
      resolver: (snapshot, stagedIntents) => {
        const delta = stagedIntents.reduce((acc, i) => acc + (i.effect as number), 0);
        return {
          counter: snapshot.counter + delta,
          markers: [...snapshot.markers, 'COMMITTED_MARKER'],
          config: { mode: 'ACTIVE' },
        };
      },
      deriveEvents: (committedState) => {
        observedStateInDerivedProducer = committedState;
        // Derived event producer observes committed state and emits next-wave input
        if (committedState.counter > 0) {
          return [
            {
              timestamp: 30,
              category: EventCategory.DERIVED_EVENTS,
              type: 'POST_COMMIT_OBSERVED',
              payload: { value: committedState.counter },
            },
          ];
        }
        return [];
      },
    });

    // DerivedEventProducer observed the committed state produced by the resolver
    expect(observedStateInDerivedProducer).toEqual({
      counter: 1,
      markers: ['COMMITTED_MARKER'],
      config: { mode: 'ACTIVE' },
    });
    expect(result.derivedEvents).toHaveLength(1);
    expect(result.derivedEvents[0].category).toBe(EventCategory.DERIVED_EVENTS);
    expect(result.derivedEvents[0].type).toBe('POST_COMMIT_OBSERVED');
  });

  it('does NOT automatically execute a second batch or recursive next wave', () => {
    const initialState: TestState = { counter: 0, markers: [], config: { mode: 'IDLE' } };
    let evaluatorExecutionCount = 0;

    const batch: EventBatch<DomainEvent<string>> = {
      timestamp: 10,
      category: EventCategory.PLAYER_INPUT,
      events: [
        { timestamp: 10, category: EventCategory.PLAYER_INPUT, type: 'INPUT', payload: 'val' },
      ],
    };

    const result = executeEventBatch({
      state: initialState,
      batch,
      evaluator: () => {
        evaluatorExecutionCount++;
        return [{ target: 'TEST', effect: 'ok' }];
      },
      resolver: (snapshot) => snapshot,
      deriveEvents: () => [
        { timestamp: 10, category: EventCategory.DERIVED_EVENTS, type: 'DERIVED_1', payload: 'derived' },
      ],
    });

    // Exactly one batch evaluation executed; derived events returned without automatic continuation
    expect(evaluatorExecutionCount).toBe(1);
    expect(result.derivedEvents).toHaveLength(1);
  });
});

describe('Character Posture & Squad Posture Intent Concepts (GS-001, GS-002)', () => {
  it('exposes exactly four canonical Character Posture states', () => {
    expect(Object.keys(CharacterPosture).sort()).toEqual([
      'COVERED',
      'EXPOSED',
      'TRANSITIONING_TO_COVERED',
      'TRANSITIONING_TO_EXPOSED',
    ]);
    expect(CharacterPosture.COVERED).toBe('COVERED');
    expect(CharacterPosture.EXPOSED).toBe('EXPOSED');
    expect(CharacterPosture.TRANSITIONING_TO_COVERED).toBe('TRANSITIONING_TO_COVERED');
    expect(CharacterPosture.TRANSITIONING_TO_EXPOSED).toBe('TRANSITIONING_TO_EXPOSED');
  });

  it('exposes exactly two canonical Squad Posture Intent states', () => {
    expect(Object.keys(SquadPostureIntent).sort()).toEqual(['WANT_COVERED', 'WANT_EXPOSED']);
    expect(SquadPostureIntent.WANT_COVERED).toBe('WANT_COVERED');
    expect(SquadPostureIntent.WANT_EXPOSED).toBe('WANT_EXPOSED');
  });

  it('validates Character Posture values at runtime', () => {
    expect(isCharacterPosture('COVERED')).toBe(true);
    expect(isCharacterPosture('EXPOSED')).toBe(true);
    expect(isCharacterPosture('TRANSITIONING_TO_COVERED')).toBe(true);
    expect(isCharacterPosture('TRANSITIONING_TO_EXPOSED')).toBe(true);
    expect(isCharacterPosture('INVALID_POSTURE')).toBe(false);
    expect(isCharacterPosture(null)).toBe(false);
    expect(isCharacterPosture(undefined)).toBe(false);

    expect(() => assertCharacterPosture('COVERED')).not.toThrow();
    expect(() => assertCharacterPosture('UNKNOWN')).toThrow(TypeError);
  });

  it('validates Stable Character Posture values at runtime (excludes transitional postures)', () => {
    expect(isStableCharacterPosture('COVERED')).toBe(true);
    expect(isStableCharacterPosture('EXPOSED')).toBe(true);
    expect(isStableCharacterPosture('TRANSITIONING_TO_COVERED')).toBe(false);
    expect(isStableCharacterPosture('TRANSITIONING_TO_EXPOSED')).toBe(false);
    expect(isStableCharacterPosture('INVALID')).toBe(false);

    expect(() => assertStableCharacterPosture('COVERED')).not.toThrow();
    expect(() => assertStableCharacterPosture('EXPOSED')).not.toThrow();
    expect(() => assertStableCharacterPosture('TRANSITIONING_TO_COVERED')).toThrow(TypeError);
    expect(() => assertStableCharacterPosture('TRANSITIONING_TO_EXPOSED')).toThrow(TypeError);
  });

  it('validates Squad Posture Intent values at runtime', () => {
    expect(isSquadPostureIntent('WANT_COVERED')).toBe(true);
    expect(isSquadPostureIntent('WANT_EXPOSED')).toBe(true);
    expect(isSquadPostureIntent('INVALID_INTENT')).toBe(false);
    expect(isSquadPostureIntent(123)).toBe(false);

    expect(() => assertSquadPostureIntent('WANT_EXPOSED')).not.toThrow();
    expect(() => assertSquadPostureIntent('UNKNOWN')).toThrow(TypeError);
  });
});

describe('Explicit Initialization & Authority Boundary (GS-001, GS-002)', () => {
  it('accepts initial COVERED when explicitly supplied', () => {
    const coveredState = createInitialCharacterPostureState(CharacterPosture.COVERED);
    expect(coveredState.posture).toBe(CharacterPosture.COVERED);
    expect(Object.isFrozen(coveredState)).toBe(true);
  });

  it('accepts initial EXPOSED when explicitly supplied', () => {
    const exposedState = createInitialCharacterPostureState(CharacterPosture.EXPOSED);
    expect(exposedState.posture).toBe(CharacterPosture.EXPOSED);
    expect(Object.isFrozen(exposedState)).toBe(true);
  });

  it('rejects missing or invalid initial posture (no invented default COVERED or EXPOSED)', () => {
    expect(() => createInitialCharacterPostureState(undefined as unknown as StableCharacterPosture)).toThrow(TypeError);
    expect(() => createInitialCharacterPostureState(null as unknown as StableCharacterPosture)).toThrow(TypeError);
    expect(() => createInitialCharacterPostureState('RANDOM_DEFAULT' as unknown as StableCharacterPosture)).toThrow(TypeError);
  });

  it('does NOT accept transitional postures in public initial-state factory (TRANSITIONING_TO_COVERED rejected)', () => {
    expect(() =>
      createInitialCharacterPostureState(CharacterPosture.TRANSITIONING_TO_COVERED as unknown as StableCharacterPosture)
    ).toThrow(TypeError);
  });

  it('does NOT accept transitional postures in public initial-state factory (TRANSITIONING_TO_EXPOSED rejected)', () => {
    expect(() =>
      createInitialCharacterPostureState(CharacterPosture.TRANSITIONING_TO_EXPOSED as unknown as StableCharacterPosture)
    ).toThrow(TypeError);
  });

  it('prevents direct structural forging of CharacterPostureState via plain object literals', () => {
    // Ordinary typed callers cannot directly construct CharacterPostureState via plain object literals
    // @ts-expect-error Type '{ posture: "TRANSITIONING_TO_EXPOSED"; }' is not assignable to type 'CharacterPostureState' due to internal nominal brand
    const forgedTransition: CharacterPostureState = {
      posture: CharacterPosture.TRANSITIONING_TO_EXPOSED,
    };
    expect(forgedTransition.posture).toBe(CharacterPosture.TRANSITIONING_TO_EXPOSED);

    // @ts-expect-error Type '{ posture: "COVERED"; }' is not assignable to type 'CharacterPostureState' due to internal nominal brand
    const forgedStable: CharacterPostureState = {
      posture: CharacterPosture.COVERED,
    };
    expect(forgedStable.posture).toBe(CharacterPosture.COVERED);
  });

  it('requires explicit initial intent when creating SquadPostureIntentState', () => {
    const wantCoveredState = createSquadPostureIntentState(SquadPostureIntent.WANT_COVERED);
    expect(wantCoveredState.intent).toBe(SquadPostureIntent.WANT_COVERED);
    expect(Object.isFrozen(wantCoveredState)).toBe(true);

    const wantExposedState = createSquadPostureIntentState(SquadPostureIntent.WANT_EXPOSED);
    expect(wantExposedState.intent).toBe(SquadPostureIntent.WANT_EXPOSED);
  });

  it('rejects missing or invalid initial intent (no invented default WANT_COVERED or WANT_EXPOSED)', () => {
    expect(() => createSquadPostureIntentState(undefined as unknown as SquadPostureIntent)).toThrow(TypeError);
    expect(() => createSquadPostureIntentState(null as unknown as SquadPostureIntent)).toThrow(TypeError);
    expect(() => createSquadPostureIntentState('RANDOM_INTENT' as unknown as SquadPostureIntent)).toThrow(TypeError);
  });

  it('updates Squad Posture Intent independently without mutating previous object', () => {
    const initial = createSquadPostureIntentState(SquadPostureIntent.WANT_COVERED);
    const updated = updateSquadPostureIntent(initial, SquadPostureIntent.WANT_EXPOSED);

    expect(updated.intent).toBe(SquadPostureIntent.WANT_EXPOSED);
    expect(initial.intent).toBe(SquadPostureIntent.WANT_COVERED);
  });
});

describe('Intent-Driven Posture Transition Applicability (GS-001, GS-002 §2)', () => {
  it('returns TRANSITIONING_TO_EXPOSED for COVERED + WANT_EXPOSED', () => {
    expect(
      getApplicablePostureTransition(CharacterPosture.COVERED, SquadPostureIntent.WANT_EXPOSED)
    ).toBe(CharacterPosture.TRANSITIONING_TO_EXPOSED);
  });

  it('returns TRANSITIONING_TO_COVERED for EXPOSED + WANT_COVERED', () => {
    expect(
      getApplicablePostureTransition(CharacterPosture.EXPOSED, SquadPostureIntent.WANT_COVERED)
    ).toBe(CharacterPosture.TRANSITIONING_TO_COVERED);
  });

  it('returns null when stable posture already satisfies Squad Intent', () => {
    expect(
      getApplicablePostureTransition(CharacterPosture.COVERED, SquadPostureIntent.WANT_COVERED)
    ).toBeNull();
    expect(
      getApplicablePostureTransition(CharacterPosture.EXPOSED, SquadPostureIntent.WANT_EXPOSED)
    ).toBeNull();
  });

  it('returns null when character is actively transitioning regardless of Squad Intent', () => {
    expect(
      getApplicablePostureTransition(
        CharacterPosture.TRANSITIONING_TO_EXPOSED,
        SquadPostureIntent.WANT_EXPOSED
      )
    ).toBeNull();
    expect(
      getApplicablePostureTransition(
        CharacterPosture.TRANSITIONING_TO_EXPOSED,
        SquadPostureIntent.WANT_COVERED
      )
    ).toBeNull();
    expect(
      getApplicablePostureTransition(
        CharacterPosture.TRANSITIONING_TO_COVERED,
        SquadPostureIntent.WANT_COVERED
      )
    ).toBeNull();
    expect(
      getApplicablePostureTransition(
        CharacterPosture.TRANSITIONING_TO_COVERED,
        SquadPostureIntent.WANT_EXPOSED
      )
    ).toBeNull();
  });
});

describe('Intent-Driven Transition Initiation & Authority Boundary (GS-002 §2)', () => {
  it('initiates TRANSITIONING_TO_EXPOSED for COVERED + WANT_EXPOSED', () => {
    const covered = createInitialCharacterPostureState(CharacterPosture.COVERED);
    const result = beginIntentDrivenPostureTransition(covered, SquadPostureIntent.WANT_EXPOSED);

    expect(result.posture).toBe(CharacterPosture.TRANSITIONING_TO_EXPOSED);
  });

  it('initiates TRANSITIONING_TO_COVERED for EXPOSED + WANT_COVERED', () => {
    const exposed = createInitialCharacterPostureState(CharacterPosture.EXPOSED);
    const result = beginIntentDrivenPostureTransition(exposed, SquadPostureIntent.WANT_COVERED);

    expect(result.posture).toBe(CharacterPosture.TRANSITIONING_TO_COVERED);
  });

  it('produces no new transition for COVERED + WANT_COVERED', () => {
    const covered = createInitialCharacterPostureState(CharacterPosture.COVERED);
    const result = beginIntentDrivenPostureTransition(covered, SquadPostureIntent.WANT_COVERED);

    expect(result.posture).toBe(CharacterPosture.COVERED);
  });

  it('produces no new transition for EXPOSED + WANT_EXPOSED', () => {
    const exposed = createInitialCharacterPostureState(CharacterPosture.EXPOSED);
    const result = beginIntentDrivenPostureTransition(exposed, SquadPostureIntent.WANT_EXPOSED);

    expect(result.posture).toBe(CharacterPosture.EXPOSED);
  });

  it('does NOT provide caller-selected arbitrary target authority in public API', () => {
    // Transition direction is derived strictly from (posture, squadIntent).
    // The public function takes strictly (currentState, squadIntent) with no target parameter.
    const covered = createInitialCharacterPostureState(CharacterPosture.COVERED);
    // When intent is WANT_COVERED, caller cannot force TRANSITIONING_TO_EXPOSED
    const result = beginIntentDrivenPostureTransition(covered, SquadPostureIntent.WANT_COVERED);
    expect(result.posture).toBe(CharacterPosture.COVERED);
  });
});

describe('Active Transition Atomicity Across Intent Changes (GS-002 §2)', () => {
  it('preserves TRANSITIONING_TO_EXPOSED when Squad Intent changes to WANT_COVERED', () => {
    // Canonically construct active transition state via beginIntentDrivenPostureTransition
    const covered = createInitialCharacterPostureState(CharacterPosture.COVERED);
    const inFlight = beginIntentDrivenPostureTransition(covered, SquadPostureIntent.WANT_EXPOSED);
    expect(inFlight.posture).toBe(CharacterPosture.TRANSITIONING_TO_EXPOSED);

    const squad = createSquadPostureIntentState(SquadPostureIntent.WANT_EXPOSED);

    // Intent changes mid-transition
    const updatedSquad = updateSquadPostureIntent(squad, SquadPostureIntent.WANT_COVERED);
    expect(updatedSquad.intent).toBe(SquadPostureIntent.WANT_COVERED);

    // Re-evaluating transition start on in-flight character preserves active transition
    const result = beginIntentDrivenPostureTransition(inFlight, updatedSquad.intent);
    expect(result.posture).toBe(CharacterPosture.TRANSITIONING_TO_EXPOSED);
  });

  it('preserves TRANSITIONING_TO_COVERED when Squad Intent changes to WANT_EXPOSED', () => {
    // Canonically construct active transition state via beginIntentDrivenPostureTransition
    const exposed = createInitialCharacterPostureState(CharacterPosture.EXPOSED);
    const inFlight = beginIntentDrivenPostureTransition(exposed, SquadPostureIntent.WANT_COVERED);
    expect(inFlight.posture).toBe(CharacterPosture.TRANSITIONING_TO_COVERED);

    const squad = createSquadPostureIntentState(SquadPostureIntent.WANT_COVERED);

    // Intent changes mid-transition
    const updatedSquad = updateSquadPostureIntent(squad, SquadPostureIntent.WANT_EXPOSED);
    expect(updatedSquad.intent).toBe(SquadPostureIntent.WANT_EXPOSED);

    // Re-evaluating transition start on in-flight character preserves active transition
    const result = beginIntentDrivenPostureTransition(inFlight, updatedSquad.intent);
    expect(result.posture).toBe(CharacterPosture.TRANSITIONING_TO_COVERED);
  });

  it('guarantees active transition cannot be cancelled, reversed, or replaced mid-flight', () => {
    // Canonically construct both active transition states
    const covered = createInitialCharacterPostureState(CharacterPosture.COVERED);
    const inFlightExpose = beginIntentDrivenPostureTransition(covered, SquadPostureIntent.WANT_EXPOSED);

    const exposed = createInitialCharacterPostureState(CharacterPosture.EXPOSED);
    const inFlightCover = beginIntentDrivenPostureTransition(exposed, SquadPostureIntent.WANT_COVERED);

    expect(beginIntentDrivenPostureTransition(inFlightCover, SquadPostureIntent.WANT_COVERED).posture).toBe(
      CharacterPosture.TRANSITIONING_TO_COVERED
    );
    expect(beginIntentDrivenPostureTransition(inFlightCover, SquadPostureIntent.WANT_EXPOSED).posture).toBe(
      CharacterPosture.TRANSITIONING_TO_COVERED
    );
    expect(beginIntentDrivenPostureTransition(inFlightExpose, SquadPostureIntent.WANT_COVERED).posture).toBe(
      CharacterPosture.TRANSITIONING_TO_EXPOSED
    );
    expect(beginIntentDrivenPostureTransition(inFlightExpose, SquadPostureIntent.WANT_EXPOSED).posture).toBe(
      CharacterPosture.TRANSITIONING_TO_EXPOSED
    );
  });
});

describe('Transition Completion & Post-Completion Intent Reevaluation (GS-002 §2)', () => {
  it('completes TRANSITIONING_TO_EXPOSED strictly to committed EXPOSED posture', () => {
    // Canonically construct active transition state
    const covered = createInitialCharacterPostureState(CharacterPosture.COVERED);
    const inFlight = beginIntentDrivenPostureTransition(covered, SquadPostureIntent.WANT_EXPOSED);

    const result = completeCharacterPostureTransition(inFlight, SquadPostureIntent.WANT_EXPOSED);

    expect(result.state.posture).toBe(CharacterPosture.EXPOSED);
    expect(result.nextApplicableTransition).toBeNull();
  });

  it('completes TRANSITIONING_TO_COVERED strictly to committed COVERED posture', () => {
    // Canonically construct active transition state
    const exposed = createInitialCharacterPostureState(CharacterPosture.EXPOSED);
    const inFlight = beginIntentDrivenPostureTransition(exposed, SquadPostureIntent.WANT_COVERED);

    const result = completeCharacterPostureTransition(inFlight, SquadPostureIntent.WANT_COVERED);

    expect(result.state.posture).toBe(CharacterPosture.COVERED);
    expect(result.nextApplicableTransition).toBeNull();
  });

  it('rejects completion call when character is already in a stable posture (COVERED or EXPOSED)', () => {
    const stableCovered = createInitialCharacterPostureState(CharacterPosture.COVERED);
    const stableExposed = createInitialCharacterPostureState(CharacterPosture.EXPOSED);

    expect(() =>
      completeCharacterPostureTransition(stableCovered, SquadPostureIntent.WANT_COVERED)
    ).toThrow(/already in stable posture/);

    expect(() =>
      completeCharacterPostureTransition(stableExposed, SquadPostureIntent.WANT_EXPOSED)
    ).toThrow(/already in stable posture/);
  });

  it('reports TRANSITIONING_TO_COVERED when completing to EXPOSED while latest intent is WANT_COVERED, without auto-executing it', () => {
    // Canonically construct active transition state
    const covered = createInitialCharacterPostureState(CharacterPosture.COVERED);
    const inFlight = beginIntentDrivenPostureTransition(covered, SquadPostureIntent.WANT_EXPOSED);

    // Completes while current squad intent is WANT_COVERED
    const result = completeCharacterPostureTransition(inFlight, SquadPostureIntent.WANT_COVERED);

    // Committed posture is EXPOSED, not immediately switched to TRANSITIONING_TO_COVERED
    expect(result.state.posture).toBe(CharacterPosture.EXPOSED);
    // Reevaluated next applicability reports the needed transition for future scheduling
    expect(result.nextApplicableTransition).toBe(CharacterPosture.TRANSITIONING_TO_COVERED);
  });

  it('reports TRANSITIONING_TO_EXPOSED when completing to COVERED while latest intent is WANT_EXPOSED, without auto-executing it', () => {
    // Canonically construct active transition state
    const exposed = createInitialCharacterPostureState(CharacterPosture.EXPOSED);
    const inFlight = beginIntentDrivenPostureTransition(exposed, SquadPostureIntent.WANT_COVERED);

    // Completes while current squad intent is WANT_EXPOSED
    const result = completeCharacterPostureTransition(inFlight, SquadPostureIntent.WANT_EXPOSED);

    // Committed posture is COVERED, not immediately switched to TRANSITIONING_TO_EXPOSED
    expect(result.state.posture).toBe(CharacterPosture.COVERED);
    // Reevaluated next applicability reports the needed transition for future scheduling
    expect(result.nextApplicableTransition).toBe(CharacterPosture.TRANSITIONING_TO_EXPOSED);
  });

  it('reports no next transition when completion destination matches latest intent', () => {
    const covered = createInitialCharacterPostureState(CharacterPosture.COVERED);
    const inFlightExpose = beginIntentDrivenPostureTransition(covered, SquadPostureIntent.WANT_EXPOSED);
    const resultExpose = completeCharacterPostureTransition(inFlightExpose, SquadPostureIntent.WANT_EXPOSED);
    expect(resultExpose.state.posture).toBe(CharacterPosture.EXPOSED);
    expect(resultExpose.nextApplicableTransition).toBeNull();

    const exposed = createInitialCharacterPostureState(CharacterPosture.EXPOSED);
    const inFlightCover = beginIntentDrivenPostureTransition(exposed, SquadPostureIntent.WANT_COVERED);
    const resultCover = completeCharacterPostureTransition(inFlightCover, SquadPostureIntent.WANT_COVERED);
    expect(resultCover.state.posture).toBe(CharacterPosture.COVERED);
    expect(resultCover.nextApplicableTransition).toBeNull();
  });
});

describe('Headless, Orthogonal & Deterministic Execution (AS-001, AS-004, GS-001)', () => {
  it('operates with zero dependency on STUN, Weapon Action, ammo, timers, or browser globals', () => {
    const covered = createInitialCharacterPostureState(CharacterPosture.COVERED);
    const inFlight = beginIntentDrivenPostureTransition(covered, SquadPostureIntent.WANT_EXPOSED);
    const completed = completeCharacterPostureTransition(inFlight, SquadPostureIntent.WANT_EXPOSED);

    expect(completed.state.posture).toBe(CharacterPosture.EXPOSED);
    // Assert all state wrappers are pure objects without window/document/timer handles
    expect(typeof window).toBe('undefined');
  });

  it('preserves getDomainState() with gameplayImplemented: false', () => {
    const domain = getDomainState();
    expect(domain.layer).toBe('domain');
    expect(domain.deterministic).toBe(true);
    expect(domain.gameplayImplemented).toBe(false);
  });
});

describe('Weapon Action Concepts & Posture Firing Prerequisite (GS-001 §2, GS-003 §1)', () => {
  it('exposes exactly three canonical Weapon Action values: IDLE, FIRING, RELOADING', () => {
    expect(Object.keys(WeaponAction).sort()).toEqual(['FIRING', 'IDLE', 'RELOADING']);
    expect(WeaponAction.IDLE).toBe('IDLE');
    expect(WeaponAction.FIRING).toBe('FIRING');
    expect(WeaponAction.RELOADING).toBe('RELOADING');
    expect('READY' in WeaponAction).toBe(false);
    expect((WeaponAction as Record<string, unknown>).READY).toBeUndefined();
  });

  it('validates canonical Weapon Action values at runtime via isWeaponAction', () => {
    expect(isWeaponAction('IDLE')).toBe(true);
    expect(isWeaponAction('FIRING')).toBe(true);
    expect(isWeaponAction('RELOADING')).toBe(true);
    expect(isWeaponAction('READY')).toBe(false);
    expect(isWeaponAction('CHARGING')).toBe(false);
    expect(isWeaponAction('INVALID_ACTION')).toBe(false);
    expect(isWeaponAction(123)).toBe(false);
    expect(isWeaponAction(null)).toBe(false);
    expect(isWeaponAction(undefined)).toBe(false);
    expect(isWeaponAction({})).toBe(false);
    expect(isWeaponAction([])).toBe(false);
  });

  it('enforces canonical Weapon Action values at runtime via assertWeaponAction', () => {
    expect(() => assertWeaponAction('IDLE')).not.toThrow();
    expect(() => assertWeaponAction('FIRING')).not.toThrow();
    expect(() => assertWeaponAction('RELOADING')).not.toThrow();
    expect(() => assertWeaponAction('READY')).toThrow(TypeError);
    expect(() => assertWeaponAction('CHARGING')).toThrow(TypeError);
    expect(() => assertWeaponAction('UNKNOWN')).toThrow(TypeError);
    expect(() => assertWeaponAction(null)).toThrow(TypeError);
    expect(() => assertWeaponAction(undefined)).toThrow(TypeError);
  });

  it('evaluates posture-side firing prerequisite according to GS-003 §1', () => {
    // Firing is strictly permitted only when the character is fully EXPOSED
    expect(doesPostureSatisfyFiringPrerequisite(CharacterPosture.EXPOSED)).toBe(true);

    // Firing is prohibited while COVERED, TRANSITIONING_TO_COVERED, or TRANSITIONING_TO_EXPOSED
    expect(doesPostureSatisfyFiringPrerequisite(CharacterPosture.COVERED)).toBe(false);
    expect(doesPostureSatisfyFiringPrerequisite(CharacterPosture.TRANSITIONING_TO_COVERED)).toBe(false);
    expect(doesPostureSatisfyFiringPrerequisite(CharacterPosture.TRANSITIONING_TO_EXPOSED)).toBe(false);
  });

  it('rejects invalid posture input consistently with assertCharacterPosture', () => {
    expect(() =>
      doesPostureSatisfyFiringPrerequisite('INVALID_POSTURE' as unknown as CharacterPosture)
    ).toThrow(TypeError);
    expect(() =>
      doesPostureSatisfyFiringPrerequisite(null as unknown as CharacterPosture)
    ).toThrow(TypeError);
    expect(() =>
      doesPostureSatisfyFiringPrerequisite(undefined as unknown as CharacterPosture)
    ).toThrow(TypeError);
  });

  it('operates as a pure, deterministic, side-effect free query with zero environmental dependency', () => {
    // Pure function returns identical result for repeated calls without mutating input
    const posture = CharacterPosture.EXPOSED;
    expect(doesPostureSatisfyFiringPrerequisite(posture)).toBe(true);
    expect(doesPostureSatisfyFiringPrerequisite(posture)).toBe(true);
    expect(posture).toBe(CharacterPosture.EXPOSED);

    // Completely decoupled from browser globals
    expect(typeof window).toBe('undefined');
  });

  it('preserves getDomainState() with gameplayImplemented: false', () => {
    const domain = getDomainState();
    expect(domain.layer).toBe('domain');
    expect(domain.deterministic).toBe(true);
    expect(domain.gameplayImplemented).toBe(false);
  });
});

describe('STUN Status & STUN-Specific Firing Blocker (GS-005 §1, §2, GS-009 §3)', () => {
  it('validates STUN status representation at runtime via isStunStatus and assertStunStatus', () => {
    expect(isStunStatus(true)).toBe(true);
    expect(isStunStatus(false)).toBe(true);
    expect(isStunStatus('true')).toBe(false);
    expect(isStunStatus(1)).toBe(false);
    expect(isStunStatus(0)).toBe(false);
    expect(isStunStatus(null)).toBe(false);
    expect(isStunStatus(undefined)).toBe(false);
    expect(isStunStatus({})).toBe(false);
    expect(isStunStatus([])).toBe(false);

    expect(() => assertStunStatus(true)).not.toThrow();
    expect(() => assertStunStatus(false)).not.toThrow();
    expect(() => assertStunStatus('STUNNED')).toThrow(TypeError);
    expect(() => assertStunStatus(null)).toThrow(TypeError);
    expect(() => assertStunStatus(undefined)).toThrow(TypeError);
    expect(() => assertStunStatus(1)).toThrow(TypeError);
  });

  it('evaluates that STUN blocks firing when isStunned is true (GS-005 §2, GS-009 §3)', () => {
    expect(doesStunBlockFiring(true)).toBe(true);
  });

  it('evaluates that STUN itself does not block firing when isStunned is false (GS-005 §2)', () => {
    // Critical authority boundary: false means strictly "STUN itself does not block firing".
    // It does NOT mean the character is globally actionable or permitted to fire.
    expect(doesStunBlockFiring(false)).toBe(false);
  });

  it('rejects invalid non-boolean runtime inputs to doesStunBlockFiring with TypeError', () => {
    expect(() => doesStunBlockFiring(null as unknown as boolean)).toThrow(TypeError);
    expect(() => doesStunBlockFiring(undefined as unknown as boolean)).toThrow(TypeError);
    expect(() => doesStunBlockFiring('true' as unknown as boolean)).toThrow(TypeError);
    expect(() => doesStunBlockFiring(1 as unknown as boolean)).toThrow(TypeError);
    expect(() => doesStunBlockFiring(0 as unknown as boolean)).toThrow(TypeError);
    expect(() => doesStunBlockFiring({} as unknown as boolean)).toThrow(TypeError);
    expect(() => doesStunBlockFiring([] as unknown as boolean)).toThrow(TypeError);
  });

  it('operates as a pure, deterministic, side-effect free query with zero environmental dependency', () => {
    // Deterministic repeated evaluation
    expect(doesStunBlockFiring(true)).toBe(true);
    expect(doesStunBlockFiring(true)).toBe(true);
    expect(doesStunBlockFiring(false)).toBe(false);
    expect(doesStunBlockFiring(false)).toBe(false);

    // Completely decoupled from browser globals, frames, and timers
    expect(typeof window).toBe('undefined');
  });

  it('preserves getDomainState() with gameplayImplemented: false', () => {
    const domain = getDomainState();
    expect(domain.layer).toBe('domain');
    expect(domain.deterministic).toBe(true);
    expect(domain.gameplayImplemented).toBe(false);
  });
});

describe('Weapon Action Explicit Domain State Representation (GS-001 §2)', () => {
  it('represents IDLE weapon action via createWeaponActionState', () => {
    const state: WeaponActionState = createWeaponActionState(WeaponAction.IDLE);
    expect(state.action).toBe(WeaponAction.IDLE);
    expect(state.action).toBe('IDLE');
  });

  it('represents FIRING weapon action via createWeaponActionState', () => {
    const state: WeaponActionState = createWeaponActionState(WeaponAction.FIRING);
    expect(state.action).toBe(WeaponAction.FIRING);
    expect(state.action).toBe('FIRING');
  });

  it('represents RELOADING weapon action via createWeaponActionState', () => {
    const state: WeaponActionState = createWeaponActionState(WeaponAction.RELOADING);
    expect(state.action).toBe(WeaponAction.RELOADING);
    expect(state.action).toBe('RELOADING');
  });

  it('enforces explicit caller requirement with no default IDLE value', () => {
    // Calling with undefined or null must be rejected with TypeError (no default assumed)
    expect(() => createWeaponActionState(undefined as unknown as WeaponAction)).toThrow(TypeError);
    expect(() => createWeaponActionState(null as unknown as WeaponAction)).toThrow(TypeError);
  });

  it('rejects invalid runtime inputs consistently with domain validation conventions', () => {
    expect(() => createWeaponActionState('INVALID_ACTION' as unknown as WeaponAction)).toThrow(TypeError);
    expect(() => createWeaponActionState('READY' as unknown as WeaponAction)).toThrow(TypeError);
    expect(() => createWeaponActionState('CHARGING' as unknown as WeaponAction)).toThrow(TypeError);
    expect(() => createWeaponActionState(123 as unknown as WeaponAction)).toThrow(TypeError);
    expect(() => createWeaponActionState({} as unknown as WeaponAction)).toThrow(TypeError);
    expect(() => createWeaponActionState([] as unknown as WeaponAction)).toThrow(TypeError);
    expect(() => createWeaponActionState(true as unknown as WeaponAction)).toThrow(TypeError);
  });

  it('returns an immutable Object.freeze wrapper consistent with current Domain conventions', () => {
    const state = createWeaponActionState(WeaponAction.IDLE);
    expect(Object.isFrozen(state)).toBe(true);
    // @ts-expect-error Cannot assign to 'action' because it is a read-only property
    expect(() => { state.action = WeaponAction.FIRING; }).toThrow();
  });

  it('ensures existing posture firing prerequisite behavior remains unchanged', () => {
    expect(doesPostureSatisfyFiringPrerequisite(CharacterPosture.EXPOSED)).toBe(true);
    expect(doesPostureSatisfyFiringPrerequisite(CharacterPosture.COVERED)).toBe(false);
    expect(doesPostureSatisfyFiringPrerequisite(CharacterPosture.TRANSITIONING_TO_COVERED)).toBe(false);
    expect(doesPostureSatisfyFiringPrerequisite(CharacterPosture.TRANSITIONING_TO_EXPOSED)).toBe(false);
  });

  it('ensures existing STUN blocker behavior remains unchanged', () => {
    expect(doesStunBlockFiring(true)).toBe(true);
    expect(doesStunBlockFiring(false)).toBe(false);
  });

  it('operates headlessly with zero browser globals and preserves gameplayImplemented: false', () => {
    expect(typeof window).toBe('undefined');
    const domain = getDomainState();
    expect(domain.layer).toBe('domain');
    expect(domain.deterministic).toBe(true);
    expect(domain.gameplayImplemented).toBe(false);
  });
});

describe('Reload Cancellation State Transitions (GS-004 §2)', () => {
  describe('Posture-Triggered Reload Cancellation', () => {
    it('cancels active reload and transitions to IDLE when beginning transition toward EXPOSED', () => {
      const reloading = createWeaponActionState(WeaponAction.RELOADING);
      const result = cancelReloadOnPostureTransition(reloading, CharacterPosture.TRANSITIONING_TO_EXPOSED);

      // Returns IDLE
      expect(result.action).toBe(WeaponAction.IDLE);
      expect(result.action).toBe('IDLE');

      // Returns a new state object (not in-place mutation)
      expect(result).not.toBe(reloading);

      // Result remains immutable / frozen
      expect(Object.isFrozen(result)).toBe(true);
      // @ts-expect-error Cannot assign to read-only property 'action'
      expect(() => { result.action = WeaponAction.FIRING; }).toThrow();

      // Original state is unmutated
      expect(reloading.action).toBe(WeaponAction.RELOADING);
    });

    it('returns identical currentState reference when character is in COVERED (trigger inactive)', () => {
      const reloading = createWeaponActionState(WeaponAction.RELOADING);
      const result = cancelReloadOnPostureTransition(reloading, CharacterPosture.COVERED);

      // Inapplicable trigger returns identical reference (no-op implementation behavior)
      expect(result).toBe(reloading);
      expect(result.action).toBe(WeaponAction.RELOADING);
    });

    it('returns identical currentState reference when character is TRANSITIONING_TO_COVERED (trigger inactive)', () => {
      const reloading = createWeaponActionState(WeaponAction.RELOADING);
      const result = cancelReloadOnPostureTransition(reloading, CharacterPosture.TRANSITIONING_TO_COVERED);

      expect(result).toBe(reloading);
      expect(result.action).toBe(WeaponAction.RELOADING);
    });

    it('returns identical currentState reference when character is in EXPOSED (trigger inactive)', () => {
      const reloading = createWeaponActionState(WeaponAction.RELOADING);
      const result = cancelReloadOnPostureTransition(reloading, CharacterPosture.EXPOSED);

      expect(result).toBe(reloading);
      expect(result.action).toBe(WeaponAction.RELOADING);
    });

    it('throws Error if currentState is IDLE (precondition contract: not reloading)', () => {
      const idle = createWeaponActionState(WeaponAction.IDLE);
      expect(() =>
        cancelReloadOnPostureTransition(idle, CharacterPosture.TRANSITIONING_TO_EXPOSED)
      ).toThrow(/Cannot cancel reload: character is not reloading/);
    });

    it('throws Error if currentState is FIRING (precondition contract: not reloading)', () => {
      const firing = createWeaponActionState(WeaponAction.FIRING);
      expect(() =>
        cancelReloadOnPostureTransition(firing, CharacterPosture.TRANSITIONING_TO_EXPOSED)
      ).toThrow(/Cannot cancel reload: character is not reloading/);
    });

    it('rejects invalid posture input with TypeError via existing assertCharacterPosture', () => {
      const reloading = createWeaponActionState(WeaponAction.RELOADING);
      expect(() =>
        cancelReloadOnPostureTransition(reloading, 'INVALID_POSTURE' as unknown as CharacterPosture)
      ).toThrow(TypeError);
      expect(() =>
        cancelReloadOnPostureTransition(reloading, null as unknown as CharacterPosture)
      ).toThrow(TypeError);
      expect(() =>
        cancelReloadOnPostureTransition(reloading, undefined as unknown as CharacterPosture)
      ).toThrow(TypeError);
    });

    it('rejects invalid currentState input with TypeError via existing assertWeaponAction', () => {
      expect(() =>
        cancelReloadOnPostureTransition(
          null as unknown as WeaponActionState,
          CharacterPosture.TRANSITIONING_TO_EXPOSED
        )
      ).toThrow(TypeError);
      expect(() =>
        cancelReloadOnPostureTransition(
          { action: 'INVALID_ACTION' as unknown as WeaponAction },
          CharacterPosture.TRANSITIONING_TO_EXPOSED
        )
      ).toThrow(TypeError);
    });
  });

  describe('STUN-Triggered Reload Cancellation', () => {
    it('cancels active reload and transitions to IDLE when isStunned is true', () => {
      const reloading = createWeaponActionState(WeaponAction.RELOADING);
      const result = cancelReloadOnStun(reloading, true);

      // Returns IDLE
      expect(result.action).toBe(WeaponAction.IDLE);
      expect(result.action).toBe('IDLE');

      // Returns a new state object (not in-place mutation)
      expect(result).not.toBe(reloading);

      // Result remains immutable / frozen
      expect(Object.isFrozen(result)).toBe(true);

      // Original state is unmutated
      expect(reloading.action).toBe(WeaponAction.RELOADING);
    });

    it('returns identical currentState reference when isStunned is false (trigger inactive)', () => {
      const reloading = createWeaponActionState(WeaponAction.RELOADING);
      const result = cancelReloadOnStun(reloading, false);

      // Inapplicable trigger returns identical reference (no-op implementation behavior)
      expect(result).toBe(reloading);
      expect(result.action).toBe(WeaponAction.RELOADING);
    });

    it('throws Error if currentState is IDLE (precondition contract: not reloading)', () => {
      const idle = createWeaponActionState(WeaponAction.IDLE);
      expect(() => cancelReloadOnStun(idle, true)).toThrow(
        /Cannot cancel reload: character is not reloading/
      );
    });

    it('throws Error if currentState is FIRING (precondition contract: not reloading)', () => {
      const firing = createWeaponActionState(WeaponAction.FIRING);
      expect(() => cancelReloadOnStun(firing, true)).toThrow(
        /Cannot cancel reload: character is not reloading/
      );
    });

    it('rejects invalid STUN input with TypeError via existing assertStunStatus', () => {
      const reloading = createWeaponActionState(WeaponAction.RELOADING);
      expect(() => cancelReloadOnStun(reloading, 'true' as unknown as boolean)).toThrow(TypeError);
      expect(() => cancelReloadOnStun(reloading, 1 as unknown as boolean)).toThrow(TypeError);
      expect(() => cancelReloadOnStun(reloading, 0 as unknown as boolean)).toThrow(TypeError);
      expect(() => cancelReloadOnStun(reloading, null as unknown as boolean)).toThrow(TypeError);
      expect(() => cancelReloadOnStun(reloading, undefined as unknown as boolean)).toThrow(TypeError);
    });

    it('rejects invalid currentState input with TypeError via existing assertWeaponAction', () => {
      expect(() => cancelReloadOnStun(null as unknown as WeaponActionState, true)).toThrow(TypeError);
      expect(() =>
        cancelReloadOnStun({ action: 'INVALID_ACTION' as unknown as WeaponAction }, true)
      ).toThrow(TypeError);
    });
  });

  describe('Authority Boundary & Headless Execution Integrity (GS-004 §2, AS-001, AS-004)', () => {
    it('verifies IDLE after cancellation denotes strictly non-firing and non-reloading status', () => {
      const reloading = createWeaponActionState(WeaponAction.RELOADING);
      const postPostureCancel = cancelReloadOnPostureTransition(
        reloading,
        CharacterPosture.TRANSITIONING_TO_EXPOSED
      );
      const postStunCancel = cancelReloadOnStun(reloading, true);

      // Both result in IDLE
      expect(postPostureCancel.action).toBe(WeaponAction.IDLE);
      expect(postStunCancel.action).toBe(WeaponAction.IDLE);

      // Critical Authority Boundary verification:
      // IDLE after cancellation does NOT imply posture prerequisite satisfaction
      expect(doesPostureSatisfyFiringPrerequisite(CharacterPosture.TRANSITIONING_TO_EXPOSED)).toBe(false);
      expect(doesPostureSatisfyFiringPrerequisite(CharacterPosture.COVERED)).toBe(false);

      // IDLE after cancellation does NOT imply absence of STUN
      expect(doesStunBlockFiring(true)).toBe(true);

      // Neither function alters posture, STUN status, ammo, or global actionability
    });

    it('confirms IDLE alone does NOT imply firing posture, non-STUN, ammo availability, or global actionability', () => {
      const idleState = createWeaponActionState(WeaponAction.IDLE);
      expect(idleState.action).toBe(WeaponAction.IDLE);

      // IDLE does not imply posture-side firing prerequisite (posture remains independent)
      expect(doesPostureSatisfyFiringPrerequisite(CharacterPosture.COVERED)).toBe(false);
      expect(doesPostureSatisfyFiringPrerequisite(CharacterPosture.TRANSITIONING_TO_EXPOSED)).toBe(false);

      // IDLE does not imply absence of STUN
      expect(doesStunBlockFiring(true)).toBe(true);

      // IDLE state has strictly only the 'action' property, no ammo or actionability fields
      expect(Object.keys(idleState)).toEqual(['action']);
    });

    it('operates as pure, deterministic state transformations with zero browser globals', () => {
      const reloading = createWeaponActionState(WeaponAction.RELOADING);
      const res1 = cancelReloadOnPostureTransition(reloading, CharacterPosture.TRANSITIONING_TO_EXPOSED);
      const res2 = cancelReloadOnPostureTransition(reloading, CharacterPosture.TRANSITIONING_TO_EXPOSED);
      expect(res1.action).toBe(res2.action);

      const res3 = cancelReloadOnStun(reloading, true);
      const res4 = cancelReloadOnStun(reloading, true);
      expect(res3.action).toBe(res4.action);

      // Headless verification
      expect(typeof window).toBe('undefined');
    });

    it('preserves getDomainState() with gameplayImplemented: false', () => {
      const domain = getDomainState();
      expect(domain.layer).toBe('domain');
      expect(domain.deterministic).toBe(true);
      expect(domain.gameplayImplemented).toBe(false);
    });
  });
});

describe('Magazine Ammunition Explicit Domain State (GS-003 §2, AS-002)', () => {
  it('validates 0 and positive safe integers via isMagazineAmmo', () => {
    // 0 is valid (GS-003 §2: magazine ammo reaches 0)
    expect(isMagazineAmmo(0)).toBe(true);
    // Positive safe integers are valid
    expect(isMagazineAmmo(1)).toBe(true);
    expect(isMagazineAmmo(30)).toBe(true);
    expect(isMagazineAmmo(100)).toBe(true);
    expect(isMagazineAmmo(Number.MAX_SAFE_INTEGER)).toBe(true);
  });

  it('asserts 0 and positive safe integers without throwing via assertMagazineAmmo', () => {
    expect(() => assertMagazineAmmo(0)).not.toThrow();
    expect(() => assertMagazineAmmo(1)).not.toThrow();
    expect(() => assertMagazineAmmo(30)).not.toThrow();
    expect(() => assertMagazineAmmo(Number.MAX_SAFE_INTEGER)).not.toThrow();
  });

  it('rejects negative integers via isMagazineAmmo and assertMagazineAmmo', () => {
    expect(isMagazineAmmo(-1)).toBe(false);
    expect(isMagazineAmmo(-30)).toBe(false);
    expect(isMagazineAmmo(Number.MIN_SAFE_INTEGER)).toBe(false);
    expect(() => assertMagazineAmmo(-1)).toThrow(TypeError);
    expect(() => assertMagazineAmmo(-30)).toThrow(TypeError);
    expect(() => assertMagazineAmmo(Number.MIN_SAFE_INTEGER)).toThrow(TypeError);
  });

  it('rejects fractional numbers via isMagazineAmmo and assertMagazineAmmo', () => {
    expect(isMagazineAmmo(0.5)).toBe(false);
    expect(isMagazineAmmo(1.1)).toBe(false);
    expect(isMagazineAmmo(29.99)).toBe(false);
    expect(isMagazineAmmo(Math.PI)).toBe(false);
    expect(() => assertMagazineAmmo(0.5)).toThrow(TypeError);
    expect(() => assertMagazineAmmo(Math.PI)).toThrow(TypeError);
  });

  it('rejects numbers beyond safe integer range via isMagazineAmmo and assertMagazineAmmo', () => {
    expect(isMagazineAmmo(Number.MAX_SAFE_INTEGER + 1)).toBe(false);
    expect(isMagazineAmmo(Number.MIN_SAFE_INTEGER - 1)).toBe(false);
    expect(() => assertMagazineAmmo(Number.MAX_SAFE_INTEGER + 1)).toThrow(TypeError);
  });

  it('rejects NaN, Infinity, and -Infinity via isMagazineAmmo and assertMagazineAmmo', () => {
    expect(isMagazineAmmo(Number.NaN)).toBe(false);
    expect(isMagazineAmmo(Number.POSITIVE_INFINITY)).toBe(false);
    expect(isMagazineAmmo(Number.NEGATIVE_INFINITY)).toBe(false);
    expect(() => assertMagazineAmmo(Number.NaN)).toThrow(TypeError);
    expect(() => assertMagazineAmmo(Number.POSITIVE_INFINITY)).toThrow(TypeError);
    expect(() => assertMagazineAmmo(Number.NEGATIVE_INFINITY)).toThrow(TypeError);
  });

  it('rejects non-number runtime inputs via isMagazineAmmo and assertMagazineAmmo', () => {
    expect(isMagazineAmmo('0')).toBe(false);
    expect(isMagazineAmmo('30')).toBe(false);
    expect(isMagazineAmmo(true)).toBe(false);
    expect(isMagazineAmmo(false)).toBe(false);
    expect(isMagazineAmmo(null)).toBe(false);
    expect(isMagazineAmmo(undefined)).toBe(false);
    expect(isMagazineAmmo({})).toBe(false);
    expect(isMagazineAmmo([])).toBe(false);

    expect(() => assertMagazineAmmo('30')).toThrow(TypeError);
    expect(() => assertMagazineAmmo(true)).toThrow(TypeError);
    expect(() => assertMagazineAmmo(null)).toThrow(TypeError);
    expect(() => assertMagazineAmmo(undefined)).toThrow(TypeError);
    expect(() => assertMagazineAmmo({})).toThrow(TypeError);
    expect(() => assertMagazineAmmo([])).toThrow(TypeError);
  });

  it('creates MagazineAmmoState with 0 preserving explicit value (GS-003 §2)', () => {
    const state: MagazineAmmoState = createMagazineAmmoState(0);
    expect(state.current).toBe(0);
  });

  it('creates MagazineAmmoState with positive safe integer preserving explicit value', () => {
    const state: MagazineAmmoState = createMagazineAmmoState(30);
    expect(state.current).toBe(30);

    const singleRoundState: MagazineAmmoState = createMagazineAmmoState(1);
    expect(singleRoundState.current).toBe(1);
  });

  it('creates MagazineAmmoState with Number.MAX_SAFE_INTEGER preserving explicit value', () => {
    const state: MagazineAmmoState = createMagazineAmmoState(Number.MAX_SAFE_INTEGER);
    expect(state.current).toBe(Number.MAX_SAFE_INTEGER);
  });

  it('requires explicit caller-supplied current value with no default 0 or full', () => {
    expect(() => createMagazineAmmoState(undefined as unknown as MagazineAmmo)).toThrow(TypeError);
    expect(() => createMagazineAmmoState(null as unknown as MagazineAmmo)).toThrow(TypeError);
  });

  it('rejects invalid numeric and non-numeric inputs in createMagazineAmmoState', () => {
    expect(() => createMagazineAmmoState(-1 as unknown as MagazineAmmo)).toThrow(TypeError);
    expect(() => createMagazineAmmoState(1.5 as unknown as MagazineAmmo)).toThrow(TypeError);
    expect(() => createMagazineAmmoState(Number.NaN as unknown as MagazineAmmo)).toThrow(TypeError);
    expect(() => createMagazineAmmoState('30' as unknown as MagazineAmmo)).toThrow(TypeError);
  });

  it('returns an immutable Object.freeze wrapper', () => {
    const state = createMagazineAmmoState(30);
    expect(Object.isFrozen(state)).toBe(true);
    // @ts-expect-error Cannot assign to 'current' because it is a read-only property
    expect(() => { state.current = 29; }).toThrow();
  });

  it('preserves structural independence from WeaponActionState, CharacterPostureState, and STUN', () => {
    const ammoState = createMagazineAmmoState(15);
    const postureState = createInitialCharacterPostureState(CharacterPosture.COVERED);
    const weaponActionState = createWeaponActionState(WeaponAction.IDLE);

    // Ammo state has only current property
    expect(Object.keys(ammoState)).toEqual(['current']);
    expect(ammoState.current).toBe(15);

    // Existing queries remain unaffected
    expect(doesPostureSatisfyFiringPrerequisite(postureState.posture)).toBe(false);
    expect(doesStunBlockFiring(false)).toBe(false);
    expect(weaponActionState.action).toBe(WeaponAction.IDLE);
  });

  it('operates headlessly with zero browser globals and preserves gameplayImplemented: false', () => {
    expect(typeof window).toBe('undefined');
    const domain = getDomainState();
    expect(domain.layer).toBe('domain');
    expect(domain.deterministic).toBe(true);
    expect(domain.gameplayImplemented).toBe(false);
  });
});

describe('Ammo Depletion Auto-Cover Response (GS-003 §2)', () => {
  it('A & B. resolves canonical coordinated response (FIRING -> IDLE, EXPOSED -> TRANSITIONING_TO_COVERED) in one call', () => {
    const firingWeapon = createWeaponActionState(WeaponAction.FIRING);
    const exposedPosture = createInitialCharacterPostureState(CharacterPosture.EXPOSED);

    const response: AmmoDepletionResponse = resolveAmmoDepletionResponse(firingWeapon, exposedPosture);

    // Coordinated result in single AmmoDepletionResponse object
    expect(response.weaponAction.action).toBe(WeaponAction.IDLE);
    expect(response.characterPosture.posture).toBe(CharacterPosture.TRANSITIONING_TO_COVERED);
  });

  it('C. preserves immutability and returns frozen objects without mutating inputs', () => {
    const firingWeapon = createWeaponActionState(WeaponAction.FIRING);
    const exposedPosture = createInitialCharacterPostureState(CharacterPosture.EXPOSED);

    const response = resolveAmmoDepletionResponse(firingWeapon, exposedPosture);

    // Outer container is frozen
    expect(Object.isFrozen(response)).toBe(true);

    // Inner state wrappers are frozen
    expect(Object.isFrozen(response.weaponAction)).toBe(true);
    expect(Object.isFrozen(response.characterPosture)).toBe(true);

    // @ts-expect-error Cannot assign to 'weaponAction' because it is a read-only property
    expect(() => { response.weaponAction = createWeaponActionState(WeaponAction.IDLE); }).toThrow();
    // @ts-expect-error Cannot assign to 'action' because it is a read-only property
    expect(() => { response.weaponAction.action = WeaponAction.FIRING; }).toThrow();
    // @ts-expect-error Cannot assign to 'posture' because it is a read-only property
    expect(() => { response.characterPosture.posture = CharacterPosture.EXPOSED; }).toThrow();

    // Inputs remain unmutated and distinct from outputs
    expect(firingWeapon.action).toBe(WeaponAction.FIRING);
    expect(exposedPosture.posture).toBe(CharacterPosture.EXPOSED);
    expect(response.weaponAction).not.toBe(firingWeapon);
    expect(response.characterPosture).not.toBe(exposedPosture);
  });

  it('D. rejects non-FIRING WeaponAction with Error (precondition contract: not actively firing)', () => {
    const exposedPosture = createInitialCharacterPostureState(CharacterPosture.EXPOSED);

    const idleWeapon = createWeaponActionState(WeaponAction.IDLE);
    expect(() => resolveAmmoDepletionResponse(idleWeapon, exposedPosture)).toThrow(
      /Cannot resolve ammo depletion response: weapon action is not FIRING/
    );

    const reloadingWeapon = createWeaponActionState(WeaponAction.RELOADING);
    expect(() => resolveAmmoDepletionResponse(reloadingWeapon, exposedPosture)).toThrow(
      /Cannot resolve ammo depletion response: weapon action is not FIRING/
    );
  });

  it('E. rejects non-EXPOSED CharacterPosture with Error (precondition contract: firing exposure invariant)', () => {
    const firingWeapon = createWeaponActionState(WeaponAction.FIRING);

    const coveredPosture = createInitialCharacterPostureState(CharacterPosture.COVERED);
    expect(() => resolveAmmoDepletionResponse(firingWeapon, coveredPosture)).toThrow(
      /Cannot resolve ammo depletion response: character posture is not EXPOSED/
    );

    const transToCovered = beginIntentDrivenPostureTransition(
      createInitialCharacterPostureState(CharacterPosture.EXPOSED),
      SquadPostureIntent.WANT_COVERED
    );
    expect(() => resolveAmmoDepletionResponse(firingWeapon, transToCovered)).toThrow(
      /Cannot resolve ammo depletion response: character posture is not EXPOSED/
    );

    const transToExposed = beginIntentDrivenPostureTransition(
      createInitialCharacterPostureState(CharacterPosture.COVERED),
      SquadPostureIntent.WANT_EXPOSED
    );
    expect(() => resolveAmmoDepletionResponse(firingWeapon, transToExposed)).toThrow(
      /Cannot resolve ammo depletion response: character posture is not EXPOSED/
    );
  });

  it('F. rejects invalid runtime inputs with TypeError according to existing domain conventions', () => {
    const firingWeapon = createWeaponActionState(WeaponAction.FIRING);
    const exposedPosture = createInitialCharacterPostureState(CharacterPosture.EXPOSED);

    // Malformed/null/undefined weaponAction
    expect(() => resolveAmmoDepletionResponse(null as unknown as WeaponActionState, exposedPosture)).toThrow(TypeError);
    expect(() => resolveAmmoDepletionResponse(undefined as unknown as WeaponActionState, exposedPosture)).toThrow(TypeError);
    expect(() => resolveAmmoDepletionResponse({ action: 'INVALID' as unknown as WeaponAction }, exposedPosture)).toThrow(TypeError);
    expect(() => resolveAmmoDepletionResponse({} as unknown as WeaponActionState, exposedPosture)).toThrow(TypeError);

    // Malformed/null/undefined characterPosture
    expect(() => resolveAmmoDepletionResponse(firingWeapon, null as unknown as CharacterPostureState)).toThrow(TypeError);
    expect(() => resolveAmmoDepletionResponse(firingWeapon, undefined as unknown as CharacterPostureState)).toThrow(TypeError);
    expect(() => resolveAmmoDepletionResponse(firingWeapon, { posture: 'INVALID' as unknown as CharacterPosture } as unknown as CharacterPostureState)).toThrow(TypeError);
    expect(() => resolveAmmoDepletionResponse(firingWeapon, {} as unknown as CharacterPostureState)).toThrow(TypeError);
  });

  it('G. validates authority boundaries: result action is IDLE (never RELOADING), does not satisfy firing prerequisite, and requires neither SquadPostureIntent nor MagazineAmmoState', () => {
    const firingWeapon = createWeaponActionState(WeaponAction.FIRING);
    const exposedPosture = createInitialCharacterPostureState(CharacterPosture.EXPOSED);

    const response = resolveAmmoDepletionResponse(firingWeapon, exposedPosture);

    // Result action is strictly IDLE, never RELOADING
    expect(response.weaponAction.action).toBe(WeaponAction.IDLE);
    expect(response.weaponAction.action).not.toBe(WeaponAction.RELOADING);

    // Result posture is strictly TRANSITIONING_TO_COVERED
    expect(response.characterPosture.posture).toBe(CharacterPosture.TRANSITIONING_TO_COVERED);

    // Authority boundary: post-depletion posture does NOT satisfy firing prerequisite
    expect(doesPostureSatisfyFiringPrerequisite(response.characterPosture.posture)).toBe(false);

    // Verified API shape: resolveAmmoDepletionResponse has arity 2 (takes only weaponAction and posture)
    expect(resolveAmmoDepletionResponse.length).toBe(2);

    // Response contains exactly the two coordinated state properties
    expect(Object.keys(response).sort()).toEqual(['characterPosture', 'weaponAction']);
  });

  it('H. operates headlessly with zero browser globals and preserves gameplayImplemented: false', () => {
    expect(typeof window).toBe('undefined');
    const domain = getDomainState();
    expect(domain.layer).toBe('domain');
    expect(domain.deterministic).toBe(true);
    expect(domain.gameplayImplemented).toBe(false);
  });
});




