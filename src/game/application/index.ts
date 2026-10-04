/**
 * TENNE Application Services Layer
 *
 * Orchestrates use cases and bridges presentation adapters to domain logic.
 *
 * Rule AS-001: Gameplay and Rendering Separation
 * Rule AS-002: Combat State Ownership (Presentation components only read domain state or dispatch intent)
 * Rule AS-004: Gameplay Logic Must Be Testable Without Browser
 * Rule GS-001: Orthogonal Posture and Weapon Action Axes
 * Rule GS-002: Squad Posture Intent and Transition Atomicity
 * Rule GS-003: Firing Posture Invariant
 *
 * NOTE: T-015 implements the Application-layer Posture Demo Session coordinator,
 * managing runtime demo state references and projecting a narrow, read-only snapshot.
 * T-015 preserves the existing Human-Trusted getDomainState().gameplayImplemented === false value.
 * This task does not define that metadata's meaning or lifecycle.
 */

import {
  CharacterPosture,
  SquadPostureIntent,
  type StableCharacterPosture,
  assertStableCharacterPosture,
  assertSquadPostureIntent,
  createInitialCharacterPostureState,
  createSquadPostureIntentState,
  updateSquadPostureIntent,
  getApplicablePostureTransition,
  beginIntentDrivenPostureTransition,
  completeCharacterPostureTransition,
  doesPostureSatisfyFiringPrerequisite,
  resolveAmmoDepletionResponse,
  type CharacterPostureState,
  type SquadPostureIntentState,
  type WeaponActionState,
} from '../domain/index.ts';

// ============================================================================
// Bootstrap Metadata (Preserved for compatibility)
// ============================================================================

export interface ApplicationMetadata {
  layer: 'application';
  status: 'BOOTSTRAP_STANDBY';
}

export function getApplicationState(): ApplicationMetadata {
  return {
    layer: 'application',
    status: 'BOOTSTRAP_STANDBY',
  };
}

// ============================================================================
// Posture Demo Snapshot Projection
// ============================================================================

/**
 * Read-only projection of the current posture demo state and derived facts.
 *
 * Exposes narrow, factual domain projections.
 *
 * CRITICAL AUTHORITY BOUNDARY:
 * - applicablePostureTransition evaluates getApplicablePostureTransition.
 * - postureFiringPrerequisiteSatisfied evaluates doesPostureSatisfyFiringPrerequisite.
 *   `true` indicates strictly that the posture-side prerequisite for firing is met (EXPOSED).
 *   It must NOT be interpreted as global canFire, global actionability, or active firing.
 * - isTransitionInProgress is an Application-level boolean projection indicating whether
 *   the character is currently in a transitional posture (TRANSITIONING_TO_COVERED or
 *   TRANSITIONING_TO_EXPOSED). It is not a new canonical gameplay rule.
 * - Does NOT expose canFire, global actionability, WeaponActionState, persistent STUN state,
 *   ammo, reload state, or squad/member identity.
 */
export interface PostureDemoSnapshot {
  readonly posture: CharacterPosture;
  readonly squadPostureIntent: SquadPostureIntent;
  readonly applicablePostureTransition: 'TRANSITIONING_TO_COVERED' | 'TRANSITIONING_TO_EXPOSED' | null;
  readonly isTransitionInProgress: boolean;
  readonly postureFiringPrerequisiteSatisfied: boolean;
}

// ============================================================================
// Posture Demo Session Service
// ============================================================================

/**
 * Application service coordinating the thin posture demo session.
 *
 * Enforces domain authority boundaries:
 * - Owns active CharacterPostureState and SquadPostureIntentState references.
 * - Never directly mutates branded Domain state; replaces references solely with return
 *   values from approved Domain operations.
 * - Delegates all transition rules to Domain functions.
 * - Exposes boolean command outcomes strictly as Application orchestration results,
 *   not canonical gameplay state.
 * - Preserves transition atomicity across mid-transition intent changes.
 * - Never automatically chains or executes follow-up transitions upon completion.
 * - Zero timers, setTimeout, frames, or browser/DOM dependencies.
 */
export interface PostureDemoSession {
  /**
   * Returns an immutable read-only snapshot projection of the current demo state.
   */
  getSnapshot(): PostureDemoSnapshot;

  /**
   * Updates the Squad Posture Intent independently (GS-002 §1).
   * Mid-transition intent updates do not reverse, cancel, or alter active posture transitions.
   */
  setSquadPostureIntent(intent: SquadPostureIntent): void;

  /**
   * Begins an intent-driven posture transition derived strictly from current posture
   * and Squad Intent (GS-002 §2).
   *
   * @returns true if an applicable transition was initiated; false if no transition was applicable.
   */
  beginTransition(): boolean;

  /**
   * Completes an active posture transition explicitly (GS-002 §2).
   *
   * @returns true if an active transition was completed; false if the character is already in a stable posture.
   */
  completeTransition(): boolean;
}

// ============================================================================
// Posture Demo Session Implementation & Factory
// ============================================================================

/**
 * [IMPLEMENTATION / DEMO INITIALIZATION CHOICES]
 * Fallback values used when caller does not specify initial posture or intent.
 * These are strictly demo bootstrap defaults, NOT canonical gameplay defaults.
 */
const DEFAULT_DEMO_POSTURE: StableCharacterPosture = CharacterPosture.COVERED;
const DEFAULT_DEMO_INTENT: SquadPostureIntent = SquadPostureIntent.WANT_COVERED;

class PostureDemoSessionImpl implements PostureDemoSession {
  private _postureState: CharacterPostureState;
  private _intentState: SquadPostureIntentState;

  constructor(
    initialPosture: StableCharacterPosture = DEFAULT_DEMO_POSTURE,
    initialIntent: SquadPostureIntent = DEFAULT_DEMO_INTENT
  ) {
    assertStableCharacterPosture(initialPosture, 'createPostureDemoSession');
    assertSquadPostureIntent(initialIntent, 'createPostureDemoSession');

    this._postureState = createInitialCharacterPostureState(initialPosture);
    this._intentState = createSquadPostureIntentState(initialIntent);
  }

  getSnapshot(): PostureDemoSnapshot {
    const posture = this._postureState.posture;
    const squadPostureIntent = this._intentState.intent;
    const applicablePostureTransition = getApplicablePostureTransition(posture, squadPostureIntent);
    const isTransitionInProgress =
      posture === CharacterPosture.TRANSITIONING_TO_COVERED ||
      posture === CharacterPosture.TRANSITIONING_TO_EXPOSED;
    const postureFiringPrerequisiteSatisfied = doesPostureSatisfyFiringPrerequisite(posture);

    // [IMPLEMENTATION CHOICE] Object.freeze provides shallow runtime immutability for the snapshot projection.
    // It is an implementation-safety choice, not canonical semantic truth.
    return Object.freeze({
      posture,
      squadPostureIntent,
      applicablePostureTransition,
      isTransitionInProgress,
      postureFiringPrerequisiteSatisfied,
    });
  }

  setSquadPostureIntent(intent: SquadPostureIntent): void {
    assertSquadPostureIntent(intent, 'setSquadPostureIntent');
    this._intentState = updateSquadPostureIntent(this._intentState, intent);
  }

  beginTransition(): boolean {
    const applicable = getApplicablePostureTransition(
      this._postureState.posture,
      this._intentState.intent
    );
    if (applicable === null) {
      return false;
    }

    const nextState = beginIntentDrivenPostureTransition(
      this._postureState,
      this._intentState.intent
    );

    if (nextState.posture === this._postureState.posture) {
      return false;
    }

    this._postureState = nextState;
    return true;
  }

  completeTransition(): boolean {
    // Guard against calling domain transition completion from a stable posture
    if (
      this._postureState.posture === CharacterPosture.COVERED ||
      this._postureState.posture === CharacterPosture.EXPOSED
    ) {
      return false;
    }

    const result = completeCharacterPostureTransition(
      this._postureState,
      this._intentState.intent
    );

    this._postureState = result.state;

    // CRITICAL: Even if result.nextApplicableTransition is non-null,
    // do NOT automatically begin that transition. Chaining requires explicit caller intent.
    return true;
  }
}

/**
 * Creates an isolated Posture Demo Session.
 *
 * @param initialPosture Optional stable initial posture. Defaults to COVERED (demo choice).
 * @param initialIntent Optional initial squad posture intent. Defaults to WANT_COVERED (demo choice).
 */
export function createPostureDemoSession(
  initialPosture?: StableCharacterPosture,
  initialIntent?: SquadPostureIntent
): PostureDemoSession {
  return new PostureDemoSessionImpl(initialPosture, initialIntent);
}

// ============================================================================
// Multi-Axis Combat Coordination Snapshot (AS-002 §2)
// ============================================================================

/**
 * Application-level multi-axis combat coordination snapshot (AS-002 §2).
 *
 * Holds references to canonical Domain state values for multi-axis orchestration.
 *
 * In accordance with AS-002 §2:
 * - This container is NOT canonical Domain ownership.
 * - It is an Application-level orchestration snapshot holding references to canonical Domain values.
 * - It does NOT imply Character-vs-Weapon structural ownership at the Domain level.
 * - Holds strictly the minimum authorized axes for ammo depletion: CharacterPostureState and WeaponActionState.
 * - Explicitly does NOT include MagazineAmmoState, STUN/control status, SquadPostureIntent,
 *   character identity, squad membership, universal character data, or general combat session data.
 */
export interface CombatCoordinationSnapshot {
  readonly characterPosture: CharacterPostureState;
  readonly weaponAction: WeaponActionState;
}

// ============================================================================
// Ammo Depletion Coordination Orchestration (AS-002 §2, GS-003 §2)
// ============================================================================

/**
 * Resolves the canonical ammo-depletion transition and returns a complete, immutable next
 * CombatCoordinationSnapshot (AS-002 §2, GS-003 §2).
 *
 * Guarantees:
 * - The helper constructs and returns a complete immutable next coordination snapshot.
 * - Both coordinated axes (CharacterPostureState and WeaponActionState) are present together.
 * - The helper never constructs or returns a partial post-depletion coordination snapshot.
 * - The input snapshot is not mutated.
 * - The returned snapshot is a new shallow-frozen container (Object.freeze).
 *
 * Non-Guarantees (Boundary):
 * - The helper does not mutate or replace caller-owned state.
 * - Actual reference replacement remains the responsibility of a future caller or state owner:
 *     currentSnapshot = resolveAmmoDepletionSnapshot(currentSnapshot);
 * - Does NOT provide database transactional atomicity, ACID, rollback, distributed atomicity,
 *   CAS, locks, multithread synchronization, or EventBatch atomicity.
 *
 * Stale-Response Boundary:
 * - The synchronous API eliminates the delayed precomputed-response window between Domain
 *   resolution and snapshot construction because both occur within one synchronous function call
 *   and the intermediate AmmoDepletionResponse is not exposed for delayed application.
 * - The API does not establish freshness of the input snapshot relative to an external state owner.
 * - No stale-input freshness mechanism or stale-response failure policy is introduced.
 *
 * Error Propagation:
 * - Delegates directly to Domain resolveAmmoDepletionResponse.
 * - Malformed Domain axis values surface Domain TypeError (from assertWeaponAction / assertCharacterPosture).
 * - Precondition violations (e.g., action not FIRING or posture not EXPOSED) surface Domain Error.
 * - Does not wrap Domain errors or invent Application error classes.
 */
export function resolveAmmoDepletionSnapshot(
  current: CombatCoordinationSnapshot
): CombatCoordinationSnapshot {
  const response = resolveAmmoDepletionResponse(
    current.weaponAction,
    current.characterPosture
  );

  return Object.freeze({
    characterPosture: response.characterPosture,
    weaponAction: response.weaponAction,
  });
}
