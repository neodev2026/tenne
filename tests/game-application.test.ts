import { describe, it, expect } from 'vitest';
import {
  getApplicationState,
  createPostureDemoSession,
  resolveAmmoDepletionSnapshot,
  createCombatAmmoPrototypeSession,
  type CombatCoordinationSnapshot,
} from '../src/game/application/index.ts';
import {
  CharacterPosture,
  SquadPostureIntent,
  type StableCharacterPosture,
  getDomainState,
  WeaponAction,
  createWeaponActionState,
  createInitialCharacterPostureState,
  type CharacterPostureState,
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

describe('Ammo Depletion Coordination Snapshot Helper (AS-002 §2, GS-003 §2)', () => {
  it('1. resolves canonical transition (FIRING -> IDLE, EXPOSED -> TRANSITIONING_TO_COVERED)', () => {
    const firingWeapon = createWeaponActionState(WeaponAction.FIRING);
    const exposedPosture = createInitialCharacterPostureState(CharacterPosture.EXPOSED);
    const input: CombatCoordinationSnapshot = Object.freeze({
      characterPosture: exposedPosture,
      weaponAction: firingWeapon,
    });

    const output = resolveAmmoDepletionSnapshot(input);

    expect(output.weaponAction.action).toBe(WeaponAction.IDLE);
    expect(output.characterPosture.posture).toBe(CharacterPosture.TRANSITIONING_TO_COVERED);
  });

  it('2. returns a new snapshot reference without mutating input snapshot', () => {
    const firingWeapon = createWeaponActionState(WeaponAction.FIRING);
    const exposedPosture = createInitialCharacterPostureState(CharacterPosture.EXPOSED);
    const input: CombatCoordinationSnapshot = Object.freeze({
      characterPosture: exposedPosture,
      weaponAction: firingWeapon,
    });

    const output = resolveAmmoDepletionSnapshot(input);

    expect(output).not.toBe(input);
    expect(input.characterPosture.posture).toBe(CharacterPosture.EXPOSED);
    expect(input.weaponAction.action).toBe(WeaponAction.FIRING);
  });

  it('3. returns a shallowly frozen output container', () => {
    const firingWeapon = createWeaponActionState(WeaponAction.FIRING);
    const exposedPosture = createInitialCharacterPostureState(CharacterPosture.EXPOSED);
    const input: CombatCoordinationSnapshot = Object.freeze({
      characterPosture: exposedPosture,
      weaponAction: firingWeapon,
    });

    const output = resolveAmmoDepletionSnapshot(input);

    expect(Object.isFrozen(output)).toBe(true);
  });

  it('4. contains both coordinated axes together in the returned snapshot', () => {
    const firingWeapon = createWeaponActionState(WeaponAction.FIRING);
    const exposedPosture = createInitialCharacterPostureState(CharacterPosture.EXPOSED);
    const input: CombatCoordinationSnapshot = Object.freeze({
      characterPosture: exposedPosture,
      weaponAction: firingWeapon,
    });

    const output = resolveAmmoDepletionSnapshot(input);

    expect(output.characterPosture).toBeDefined();
    expect(output.weaponAction).toBeDefined();
    expect(output.characterPosture.posture).toBe(CharacterPosture.TRANSITIONING_TO_COVERED);
    expect(output.weaponAction.action).toBe(WeaponAction.IDLE);
  });

  it('5. passes through Domain Error on invalid canonical preconditions', () => {
    const exposedPosture = createInitialCharacterPostureState(CharacterPosture.EXPOSED);
    const idleWeapon = createWeaponActionState(WeaponAction.IDLE);
    const nonFiringInput: CombatCoordinationSnapshot = Object.freeze({
      characterPosture: exposedPosture,
      weaponAction: idleWeapon,
    });

    expect(() => resolveAmmoDepletionSnapshot(nonFiringInput)).toThrow(
      /Cannot resolve ammo depletion response: weapon action is not FIRING/
    );

    const coveredPosture = createInitialCharacterPostureState(CharacterPosture.COVERED);
    const firingWeapon = createWeaponActionState(WeaponAction.FIRING);
    const nonExposedInput: CombatCoordinationSnapshot = Object.freeze({
      characterPosture: coveredPosture,
      weaponAction: firingWeapon,
    });

    expect(() => resolveAmmoDepletionSnapshot(nonExposedInput)).toThrow(
      /Cannot resolve ammo depletion response: character posture is not EXPOSED/
    );
  });

  it('6. passes through Domain TypeError on malformed axis value', () => {
    const exposedPosture = createInitialCharacterPostureState(CharacterPosture.EXPOSED);
    const malformedWeaponInput: CombatCoordinationSnapshot = Object.freeze({
      characterPosture: exposedPosture,
      weaponAction: { action: 'INVALID' as unknown as WeaponAction },
    });

    expect(() => resolveAmmoDepletionSnapshot(malformedWeaponInput)).toThrow(TypeError);

    const firingWeapon = createWeaponActionState(WeaponAction.FIRING);
    const malformedPostureInput: CombatCoordinationSnapshot = Object.freeze({
      characterPosture: { posture: 'INVALID' as unknown as CharacterPosture } as unknown as CharacterPostureState,
      weaponAction: firingWeapon,
    });

    expect(() => resolveAmmoDepletionSnapshot(malformedPostureInput)).toThrow(TypeError);
  });
});

describe('Prototype-Scoped Combat Ammo Application Session (AS-002 §3, GS-003 §2, §3)', () => {
  it('initializes with default EXPOSED, FIRING, 3 ammo, and isFiringResolutionAvailable === true', () => {
    const session = createCombatAmmoPrototypeSession();
    const snapshot = session.getSnapshot();

    expect(snapshot.posture).toBe(CharacterPosture.EXPOSED);
    expect(snapshot.weaponAction).toBe(WeaponAction.FIRING);
    expect(snapshot.magazineAmmo).toBe(3);
    expect(snapshot.isFiringResolutionAvailable).toBe(true);
    expect(Object.isFrozen(snapshot)).toBe(true);
  });

  it('supports custom valid initialization options and derives isFiringResolutionAvailable accurately', () => {
    const sessionCovered = createCombatAmmoPrototypeSession({
      initialPosture: CharacterPosture.COVERED,
      initialWeaponAction: WeaponAction.IDLE,
      initialMagazineAmmo: 5,
    });
    const coveredSnapshot = sessionCovered.getSnapshot();
    expect(coveredSnapshot.posture).toBe(CharacterPosture.COVERED);
    expect(coveredSnapshot.weaponAction).toBe(WeaponAction.IDLE);
    expect(coveredSnapshot.magazineAmmo).toBe(5);
    expect(coveredSnapshot.isFiringResolutionAvailable).toBe(false);

    const sessionZeroAmmo = createCombatAmmoPrototypeSession({
      initialPosture: CharacterPosture.EXPOSED,
      initialWeaponAction: WeaponAction.FIRING,
      initialMagazineAmmo: 0,
    });
    expect(sessionZeroAmmo.getSnapshot().isFiringResolutionAvailable).toBe(false);
  });

  it('rejects invalid posture, weaponAction, or magazineAmmo at runtime with TypeError', () => {
    expect(() =>
      createCombatAmmoPrototypeSession({
        initialPosture: CharacterPosture.TRANSITIONING_TO_COVERED as unknown as StableCharacterPosture,
      })
    ).toThrow(TypeError);

    expect(() =>
      createCombatAmmoPrototypeSession({
        initialPosture: 'INVALID_POSTURE' as unknown as StableCharacterPosture,
      })
    ).toThrow(TypeError);

    expect(() =>
      createCombatAmmoPrototypeSession({
        initialWeaponAction: 'INVALID_ACTION' as unknown as WeaponAction,
      })
    ).toThrow(TypeError);

    expect(() =>
      createCombatAmmoPrototypeSession({
        initialMagazineAmmo: -1,
      })
    ).toThrow(TypeError);

    expect(() =>
      createCombatAmmoPrototypeSession({
        initialMagazineAmmo: 1.5,
      })
    ).toThrow(TypeError);
  });

  it('resolves multi-round sequence 3 -> 2 -> 1 -> 0 with synchronous final-round depletion coordination', () => {
    const session = createCombatAmmoPrototypeSession();

    // Round 1: 3 -> 2 (stays EXPOSED + FIRING)
    expect(session.resolveSingleFiring()).toBe(true);
    let snap = session.getSnapshot();
    expect(snap.magazineAmmo).toBe(2);
    expect(snap.posture).toBe(CharacterPosture.EXPOSED);
    expect(snap.weaponAction).toBe(WeaponAction.FIRING);
    expect(snap.isFiringResolutionAvailable).toBe(true);

    // Round 2: 2 -> 1 (stays EXPOSED + FIRING)
    expect(session.resolveSingleFiring()).toBe(true);
    snap = session.getSnapshot();
    expect(snap.magazineAmmo).toBe(1);
    expect(snap.posture).toBe(CharacterPosture.EXPOSED);
    expect(snap.weaponAction).toBe(WeaponAction.FIRING);
    expect(snap.isFiringResolutionAvailable).toBe(true);

    // Final Round 3: 1 -> 0 (synchronously transitions to IDLE + TRANSITIONING_TO_COVERED)
    expect(session.resolveSingleFiring()).toBe(true);
    snap = session.getSnapshot();
    expect(snap.magazineAmmo).toBe(0);
    expect(snap.posture).toBe(CharacterPosture.TRANSITIONING_TO_COVERED);
    expect(snap.weaponAction).toBe(WeaponAction.IDLE);
    expect(snap.isFiringResolutionAvailable).toBe(false);
    expect(Object.isFrozen(snap)).toBe(true);
  });

  it('returns false and leaves state unchanged when resolveSingleFiring is called after depletion or unmet preconditions', () => {
    const session = createCombatAmmoPrototypeSession({ initialMagazineAmmo: 1 });
    expect(session.resolveSingleFiring()).toBe(true);

    // Post-depletion call returns false and leaves state untouched
    expect(session.resolveSingleFiring()).toBe(false);
    const snap = session.getSnapshot();
    expect(snap.magazineAmmo).toBe(0);
    expect(snap.posture).toBe(CharacterPosture.TRANSITIONING_TO_COVERED);
    expect(snap.weaponAction).toBe(WeaponAction.IDLE);
    expect(snap.isFiringResolutionAvailable).toBe(false);

    // Unmet preconditions (COVERED or IDLE)
    const coveredSession = createCombatAmmoPrototypeSession({
      initialPosture: CharacterPosture.COVERED,
      initialWeaponAction: WeaponAction.FIRING,
      initialMagazineAmmo: 3,
    });
    expect(coveredSession.resolveSingleFiring()).toBe(false);
    expect(coveredSession.getSnapshot().magazineAmmo).toBe(3);
  });

  it('restores initial prototype state cleanly via resetPrototype()', () => {
    const session = createCombatAmmoPrototypeSession({
      initialPosture: CharacterPosture.EXPOSED,
      initialWeaponAction: WeaponAction.FIRING,
      initialMagazineAmmo: 2,
    });

    expect(session.resolveSingleFiring()).toBe(true);
    expect(session.resolveSingleFiring()).toBe(true);
    expect(session.getSnapshot().magazineAmmo).toBe(0);
    expect(session.getSnapshot().posture).toBe(CharacterPosture.TRANSITIONING_TO_COVERED);
    expect(session.getSnapshot().weaponAction).toBe(WeaponAction.IDLE);

    session.resetPrototype();

    const restored = session.getSnapshot();
    expect(restored.magazineAmmo).toBe(2);
    expect(restored.posture).toBe(CharacterPosture.EXPOSED);
    expect(restored.weaponAction).toBe(WeaponAction.FIRING);
    expect(restored.isFiringResolutionAvailable).toBe(true);
    expect(Object.isFrozen(restored)).toBe(true);
  });

  it('preserves snapshot immutability, excludes canonical canFire, and keeps PostureDemoSession & CombatCoordinationSnapshot unchanged', () => {
    const session = createCombatAmmoPrototypeSession();
    const snap = session.getSnapshot();
    expect(Object.isFrozen(snap)).toBe(true);
    expect((snap as unknown as Record<string, unknown>).canFire).toBeUndefined();

    // PostureDemoSession remains posture-only
    const postureSession = createPostureDemoSession();
    expect((postureSession.getSnapshot() as unknown as Record<string, unknown>).magazineAmmo).toBeUndefined();

    // CombatCoordinationSnapshot remains strictly 2-axis
    const coordSnap: CombatCoordinationSnapshot = Object.freeze({
      characterPosture: createInitialCharacterPostureState(CharacterPosture.EXPOSED),
      weaponAction: createWeaponActionState(WeaponAction.FIRING),
    });
    const nextCoord = resolveAmmoDepletionSnapshot(coordSnap);
    expect(Object.keys(nextCoord).sort()).toEqual(['characterPosture', 'weaponAction']);
  });
});


describe('M-002 Cover and Reload Prototype (AS-002 §4)', () => {
  const commands = [
    ['completeCoverTransition', 'isCoverTransitionCompletionAvailable'],
    ['startReload', 'isReloadStartAvailable'],
    ['completeReload', 'isReloadCompletionAvailable'],
    ['beginExposure', 'isExposureStartAvailable'],
    ['completeExposure', 'isExposureCompletionAvailable'],
  ] as const;

  it('publishes one eligible step at a time and completes two firing cycles', () => {
    const session = createCombatAmmoPrototypeSession();
    const assertStep = (posture: CharacterPosture, weaponAction: WeaponAction, ammo: number, active?: typeof commands[number][0]) => {
      const snapshot = session.getSnapshot();
      expect(snapshot).toMatchObject({ posture, weaponAction, magazineAmmo: ammo });
      expect(Object.isFrozen(snapshot)).toBe(true);
      for (const [command, flag] of commands) {
        expect(snapshot[flag]).toBe(command === active);
        if (command !== active) {
          expect(session[command]()).toBe(false);
          expect(session.getSnapshot()).toEqual(snapshot);
        }
      }
    };

    assertStep(CharacterPosture.EXPOSED, WeaponAction.FIRING, 3);
    for (let cycle = 0; cycle < 2; cycle += 1) {
      for (const ammo of [2, 1, 0]) {
        expect(session.resolveSingleFiring()).toBe(true);
        expect(session.getSnapshot().magazineAmmo).toBe(ammo);
      }
      assertStep(CharacterPosture.TRANSITIONING_TO_COVERED, WeaponAction.IDLE, 0, 'completeCoverTransition');
      expect(session.completeCoverTransition()).toBe(true);
      assertStep(CharacterPosture.COVERED, WeaponAction.IDLE, 0, 'startReload');
      expect(session.startReload()).toBe(true);
      assertStep(CharacterPosture.COVERED, WeaponAction.RELOADING, 0, 'completeReload');
      expect(session.completeReload()).toBe(true);
      assertStep(CharacterPosture.COVERED, WeaponAction.IDLE, 3, 'beginExposure');
      expect(session.beginExposure()).toBe(true);
      assertStep(CharacterPosture.TRANSITIONING_TO_EXPOSED, WeaponAction.IDLE, 3, 'completeExposure');
      expect(session.resolveSingleFiring()).toBe(false);
      expect(session.completeExposure()).toBe(true);
      assertStep(CharacterPosture.EXPOSED, WeaponAction.FIRING, 3);
      expect(session.getSnapshot().isFiringResolutionAvailable).toBe(true);
    }
  });

  it('refills to the fixed prototype default and resets to configured initial ammo', () => {
    const session = createCombatAmmoPrototypeSession({ initialMagazineAmmo: 1 });
    expect(session.resolveSingleFiring()).toBe(true);
    expect(session.completeCoverTransition()).toBe(true);
    expect(session.startReload()).toBe(true);
    expect(session.completeReload()).toBe(true);
    expect(session.getSnapshot().magazineAmmo).toBe(3);

    session.resetPrototype();
    expect(session.getSnapshot().magazineAmmo).toBe(1);
    expect(session.getSnapshot().isExposureStartAvailable).toBe(false);
    expect(session.beginExposure()).toBe(false);
  });

  it('requires a completed walkthrough step even when options match its posture and ammo', () => {
    const session = createCombatAmmoPrototypeSession({
      initialPosture: CharacterPosture.COVERED,
      initialWeaponAction: WeaponAction.IDLE,
      initialMagazineAmmo: 0,
    });

    const initial = session.getSnapshot();
    for (const [command, flag] of commands) {
      expect(initial[flag]).toBe(false);
      expect(session[command]()).toBe(false);
      expect(session.getSnapshot()).toEqual(initial);
    }
  });
});
