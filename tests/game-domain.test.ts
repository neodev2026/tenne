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
