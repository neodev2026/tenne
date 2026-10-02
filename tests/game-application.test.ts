import { describe, it, expect } from 'vitest';
import {
  getApplicationState,
  createPostureDemoSession,
} from '../src/game/application/index.ts';
import {
  CharacterPosture,
  SquadPostureIntent,
  type StableCharacterPosture,
  getDomainState,
} from '../src/game/domain/index.ts';

describe('Application Layer Architecture & Metadata (AS-001, AS-004)', () => {
  it('preserves getApplicationState() in BOOTSTRAP_STANDBY for compatibility', () => {
    const appState = getApplicationState();
    expect(appState.layer).toBe('application');
    expect(appState.status).toBe('BOOTSTRAP_STANDBY');
  });

  it('preserves getDomainState().gameplayImplemented === false (not modified by application session)', () => {
    const domainState = getDomainState();
    expect(domainState.layer).toBe('domain');
    expect(domainState.deterministic).toBe(true);
    expect(domainState.gameplayImplemented).toBe(false);
  });
});

describe('Posture Demo Session Initialization (GS-001, GS-002)', () => {
  it('initializes with fallback COVERED and WANT_COVERED as documented demo choices', () => {
    const session = createPostureDemoSession();
    const snapshot = session.getSnapshot();

    expect(snapshot.posture).toBe(CharacterPosture.COVERED);
    expect(snapshot.squadPostureIntent).toBe(SquadPostureIntent.WANT_COVERED);
    expect(snapshot.applicablePostureTransition).toBeNull();
    expect(snapshot.isTransitionInProgress).toBe(false);
    expect(snapshot.postureFiringPrerequisiteSatisfied).toBe(false);
  });

  it('supports explicit caller-provided initial stable posture and squad intent', () => {
    const session = createPostureDemoSession(
      CharacterPosture.EXPOSED,
      SquadPostureIntent.WANT_EXPOSED
    );
    const snapshot = session.getSnapshot();

    expect(snapshot.posture).toBe(CharacterPosture.EXPOSED);
    expect(snapshot.squadPostureIntent).toBe(SquadPostureIntent.WANT_EXPOSED);
    expect(snapshot.applicablePostureTransition).toBeNull();
    expect(snapshot.isTransitionInProgress).toBe(false);
    expect(snapshot.postureFiringPrerequisiteSatisfied).toBe(true);
  });

  it('rejects transitional postures on initialization (enforces stable-only initialization authority)', () => {
    expect(() =>
      createPostureDemoSession(
        CharacterPosture.TRANSITIONING_TO_COVERED as unknown as StableCharacterPosture,
        SquadPostureIntent.WANT_COVERED
      )
    ).toThrow(TypeError);

    expect(() =>
      createPostureDemoSession(
        CharacterPosture.TRANSITIONING_TO_EXPOSED as unknown as StableCharacterPosture,
        SquadPostureIntent.WANT_EXPOSED
      )
    ).toThrow(TypeError);

    expect(() =>
      createPostureDemoSession('INVALID_POSTURE' as unknown as StableCharacterPosture)
    ).toThrow(TypeError);
  });

  it('rejects invalid squad posture intent on initialization', () => {
    expect(() =>
      createPostureDemoSession(
        CharacterPosture.COVERED,
        'INVALID_INTENT' as unknown as SquadPostureIntent
      )
    ).toThrow(TypeError);
  });
});

describe('Posture Demo Snapshot Projection & Authority Boundaries (GS-003 §1)', () => {
  it('accurately derives postureFiringPrerequisiteSatisfied strictly for EXPOSED', () => {
    // COVERED
    const sessionCovered = createPostureDemoSession(CharacterPosture.COVERED);
    expect(sessionCovered.getSnapshot().postureFiringPrerequisiteSatisfied).toBe(false);

    // EXPOSED
    const sessionExposed = createPostureDemoSession(CharacterPosture.EXPOSED);
    expect(sessionExposed.getSnapshot().postureFiringPrerequisiteSatisfied).toBe(true);

    // In transition to COVERED
    sessionExposed.setSquadPostureIntent(SquadPostureIntent.WANT_COVERED);
    sessionExposed.beginTransition();
    expect(sessionExposed.getSnapshot().posture).toBe(CharacterPosture.TRANSITIONING_TO_COVERED);
    expect(sessionExposed.getSnapshot().postureFiringPrerequisiteSatisfied).toBe(false);

    // In transition to EXPOSED
    const sessionCoveredToExposed = createPostureDemoSession(CharacterPosture.COVERED, SquadPostureIntent.WANT_EXPOSED);
    sessionCoveredToExposed.beginTransition();
    expect(sessionCoveredToExposed.getSnapshot().posture).toBe(CharacterPosture.TRANSITIONING_TO_EXPOSED);
    expect(sessionCoveredToExposed.getSnapshot().postureFiringPrerequisiteSatisfied).toBe(false);
  });

  it('accurately derives applicablePostureTransition and isTransitionInProgress', () => {
    const session = createPostureDemoSession(CharacterPosture.COVERED, SquadPostureIntent.WANT_COVERED);
    let snapshot = session.getSnapshot();
    expect(snapshot.applicablePostureTransition).toBeNull();
    expect(snapshot.isTransitionInProgress).toBe(false);

    // Set intent to WANT_EXPOSED: transition becomes applicable
    session.setSquadPostureIntent(SquadPostureIntent.WANT_EXPOSED);
    snapshot = session.getSnapshot();
    expect(snapshot.applicablePostureTransition).toBe(CharacterPosture.TRANSITIONING_TO_EXPOSED);
    expect(snapshot.isTransitionInProgress).toBe(false);

    // Begin transition: isTransitionInProgress becomes true, applicable becomes null
    session.beginTransition();
    snapshot = session.getSnapshot();
    expect(snapshot.posture).toBe(CharacterPosture.TRANSITIONING_TO_EXPOSED);
    expect(snapshot.applicablePostureTransition).toBeNull();
    expect(snapshot.isTransitionInProgress).toBe(true);

    // Complete transition: isTransitionInProgress becomes false
    session.completeTransition();
    snapshot = session.getSnapshot();
    expect(snapshot.posture).toBe(CharacterPosture.EXPOSED);
    expect(snapshot.applicablePostureTransition).toBeNull();
    expect(snapshot.isTransitionInProgress).toBe(false);
  });

  it('does NOT expose canFire, global actionability, weapon action, or STUN properties on the snapshot', () => {
    const session = createPostureDemoSession(CharacterPosture.EXPOSED, SquadPostureIntent.WANT_EXPOSED);
    const snapshot = session.getSnapshot() as unknown as Record<string, unknown>;

    expect(snapshot.canFire).toBeUndefined();
    expect(snapshot.isActionable).toBeUndefined();
    expect(snapshot.weaponAction).toBeUndefined();
    expect(snapshot.weaponActionState).toBeUndefined();
    expect(snapshot.stun).toBeUndefined();
    expect(snapshot.isStunned).toBeUndefined();
    expect(snapshot.ammo).toBeUndefined();
    expect(snapshot.characters).toBeUndefined();
  });
});

describe('Squad Posture Intent Management & Mid-Transition Independence (GS-002 §1, §2)', () => {
  it('updates squad intent independently and idempotently', () => {
    const session = createPostureDemoSession(CharacterPosture.COVERED, SquadPostureIntent.WANT_COVERED);
    session.setSquadPostureIntent(SquadPostureIntent.WANT_EXPOSED);
    expect(session.getSnapshot().squadPostureIntent).toBe(SquadPostureIntent.WANT_EXPOSED);

    // Idempotent update
    session.setSquadPostureIntent(SquadPostureIntent.WANT_EXPOSED);
    expect(session.getSnapshot().squadPostureIntent).toBe(SquadPostureIntent.WANT_EXPOSED);
  });

  it('rejects invalid squad intent at runtime with TypeError', () => {
    const session = createPostureDemoSession();
    expect(() => session.setSquadPostureIntent('INVALID' as unknown as SquadPostureIntent)).toThrow(TypeError);
    expect(() => session.setSquadPostureIntent(null as unknown as SquadPostureIntent)).toThrow(TypeError);
  });

  it('preserves active posture transition atomicity across mid-transition intent changes', () => {
    const session = createPostureDemoSession(CharacterPosture.COVERED, SquadPostureIntent.WANT_EXPOSED);
    expect(session.beginTransition()).toBe(true);
    expect(session.getSnapshot().posture).toBe(CharacterPosture.TRANSITIONING_TO_EXPOSED);

    // Change intent mid-transition from WANT_EXPOSED to WANT_COVERED
    session.setSquadPostureIntent(SquadPostureIntent.WANT_COVERED);

    // Active transition is NOT aborted, cancelled, or reversed
    const snapshot = session.getSnapshot();
    expect(snapshot.posture).toBe(CharacterPosture.TRANSITIONING_TO_EXPOSED);
    expect(snapshot.squadPostureIntent).toBe(SquadPostureIntent.WANT_COVERED);
    expect(snapshot.isTransitionInProgress).toBe(true);
  });
});

describe('Transition Execution & Outcome Semantics (GS-002 §2)', () => {
  it('beginTransition returns true and updates state when transition is applicable', () => {
    const session = createPostureDemoSession(CharacterPosture.COVERED, SquadPostureIntent.WANT_EXPOSED);
    expect(session.beginTransition()).toBe(true);
    expect(session.getSnapshot().posture).toBe(CharacterPosture.TRANSITIONING_TO_EXPOSED);
  });

  it('beginTransition returns false and leaves state unchanged when no transition is applicable', () => {
    // Posture matches intent
    const session = createPostureDemoSession(CharacterPosture.COVERED, SquadPostureIntent.WANT_COVERED);
    expect(session.beginTransition()).toBe(false);
    expect(session.getSnapshot().posture).toBe(CharacterPosture.COVERED);

    // Already in transition
    session.setSquadPostureIntent(SquadPostureIntent.WANT_EXPOSED);
    expect(session.beginTransition()).toBe(true);
    expect(session.getSnapshot().posture).toBe(CharacterPosture.TRANSITIONING_TO_EXPOSED);

    // Calling beginTransition again while transitioning returns false
    expect(session.beginTransition()).toBe(false);
    expect(session.getSnapshot().posture).toBe(CharacterPosture.TRANSITIONING_TO_EXPOSED);
  });

  it('completeTransition returns true and commits destination posture during active transition', () => {
    const session = createPostureDemoSession(CharacterPosture.COVERED, SquadPostureIntent.WANT_EXPOSED);
    session.beginTransition();
    expect(session.getSnapshot().posture).toBe(CharacterPosture.TRANSITIONING_TO_EXPOSED);

    expect(session.completeTransition()).toBe(true);
    expect(session.getSnapshot().posture).toBe(CharacterPosture.EXPOSED);
    expect(session.getSnapshot().isTransitionInProgress).toBe(false);
  });

  it('completeTransition returns false and does not mutate when called on already-stable posture', () => {
    const session = createPostureDemoSession(CharacterPosture.COVERED, SquadPostureIntent.WANT_COVERED);
    expect(session.completeTransition()).toBe(false);
    expect(session.getSnapshot().posture).toBe(CharacterPosture.COVERED);

    const sessionExposed = createPostureDemoSession(CharacterPosture.EXPOSED, SquadPostureIntent.WANT_EXPOSED);
    expect(sessionExposed.completeTransition()).toBe(false);
    expect(sessionExposed.getSnapshot().posture).toBe(CharacterPosture.EXPOSED);
  });

  it('completeTransition NEVER automatically begins a subsequent applicable transition', () => {
    // Start COVERED, intent WANT_EXPOSED
    const session = createPostureDemoSession(CharacterPosture.COVERED, SquadPostureIntent.WANT_EXPOSED);
    session.beginTransition();
    expect(session.getSnapshot().posture).toBe(CharacterPosture.TRANSITIONING_TO_EXPOSED);

    // Mid-transition, change intent to WANT_COVERED
    session.setSquadPostureIntent(SquadPostureIntent.WANT_COVERED);

    // Complete transition: destination is EXPOSED
    expect(session.completeTransition()).toBe(true);
    const snapshot = session.getSnapshot();

    // MUST be EXPOSED, not automatically chained to TRANSITIONING_TO_COVERED!
    expect(snapshot.posture).toBe(CharacterPosture.EXPOSED);
    expect(snapshot.squadPostureIntent).toBe(SquadPostureIntent.WANT_COVERED);
    expect(snapshot.applicablePostureTransition).toBe(CharacterPosture.TRANSITIONING_TO_COVERED);
    expect(snapshot.isTransitionInProgress).toBe(false);

    // Second transition requires explicit caller beginTransition() call
    expect(session.beginTransition()).toBe(true);
    expect(session.getSnapshot().posture).toBe(CharacterPosture.TRANSITIONING_TO_COVERED);
  });
});

describe('Execution Isolation & Environmental Independence (AS-004)', () => {
  it('executes in pure headless Node.js without browser or DOM globals', () => {
    expect(typeof window).toBe('undefined');
    expect(typeof document).toBe('undefined');
  });

  it('operates deterministically across independent session instances', () => {
    const session1 = createPostureDemoSession(CharacterPosture.COVERED, SquadPostureIntent.WANT_EXPOSED);
    const session2 = createPostureDemoSession(CharacterPosture.COVERED, SquadPostureIntent.WANT_COVERED);

    session1.beginTransition();
    expect(session1.getSnapshot().posture).toBe(CharacterPosture.TRANSITIONING_TO_EXPOSED);
    expect(session2.getSnapshot().posture).toBe(CharacterPosture.COVERED);
  });
});
