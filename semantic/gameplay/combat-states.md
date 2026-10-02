# TENNE Gameplay Semantics: Combat Control, Posture & Weapon Action

> [!IMPORTANT]
> **Human Semantic Authorization (Guardrail G-041)**:
> The gameplay semantics defined in this specification (`GS-001`, `GS-002`, `GS-003`, `GS-004`, `GS-005`, and `GS-009`) are established by explicit Human Owner decision under Guardrail G-041. They replace the bootstrap metadata stubs with canonical structural specifications.
>
> In accordance with project governance, exact numerical durations, capacities, and weapon formulas are not invented by agents; remaining unresolved items are formally tracked under their existing Semantic Gap identifiers (`GAP-GS-001` through `GAP-GS-005`).

---

## GS-001: Orthogonal Posture and Weapon Action Axes
* **Domain**: Gameplay
* **Status**: Approved (Canonical)
* **Tags**: `combat`, `state-machine`, `posture`, `weapon-action`
* **Human Semantic Authorization**: Explicitly authorized by Human Owner under Guardrail G-041 (Task T-009).

### Specification
Character combat state is governed by two distinct, orthogonal state machine axes: **Posture** and **Weapon Action**. These axes must never be collapsed into a single state.

1. **Posture Axis**:
   * `COVERED`: Character is positioned fully behind cover.
   * `EXPOSED`: Character is fully exposed. Firing eligibility is governed by GS-003.
   * `TRANSITIONING_TO_COVERED`: Character is actively transitioning from exposed to covered posture.
   * `TRANSITIONING_TO_EXPOSED`: Character is actively transitioning from covered to exposed posture.

2. **Weapon Action Axis**:
   * `READY`: Weapon is operable and awaiting input or firing conditions.
   * `FIRING`: Weapon is actively discharging a round or burst.
   * `RELOADING`: A reload action is currently in progress.

3. **Orthogonality Invariant**:
   * `COVERED != RELOADING`. Being in cover does not imply reloading, and reloading does not define posture.
   * Combinations such as `COVERED + READY` (e.g. holding in cover with full or partial magazine) and `COVERED + RELOADING` are distinct, valid state combinations.

### Semantic Gap Lineage: GAP-GS-001
* **Portion Resolved by T-009**: Defined discrete Posture states, discrete Weapon Action states, and their orthogonal separation.
* **Remaining Unresolved Items**: Exact physical or simulation-time duration of posture transitions (`TRANSITIONING_TO_COVERED`, `TRANSITIONING_TO_EXPOSED`) remains an open numerical parameter pending domain specification.

---

## GS-002: Squad Posture Intent and Transition Atomicity
* **Domain**: Gameplay
* **Status**: Approved (Canonical)
* **Tags**: `combat`, `squad`, `intent`, `posture-transition`
* **Human Semantic Authorization**: Explicitly authorized by Human Owner under Guardrail G-041 (Task T-009).

### Specification
1. **Squad Posture Intent**:
   * Squad Posture Intent is a global combat state representing the squad-wide tactical directive: `WANT_COVERED` or `WANT_EXPOSED`.
   * Squad Posture Intent applies across all five squad characters simultaneously.
   * Squad Posture Intent is distinct from an individual character's Actual Posture.
   * Character-local automatic actions (such as automatic cover transition triggered by ammo depletion) must **never** modify the global Squad Posture Intent.

2. **Posture Transition Atomicity**:
   * Once an individual character begins a posture transition (`TRANSITIONING_TO_COVERED` or `TRANSITIONING_TO_EXPOSED`), the transition is atomic:
     * It cannot be cancelled.
     * It cannot be reversed mid-transition.
     * Receiving `STUN` does not abort or freeze the ongoing transition; the transition completes to its target posture.
   * If Squad Posture Intent changes while a character transition is in progress:
     * The updated Squad Posture Intent is recorded immediately.
     * The active transition continues uninterrupted until completion.
     * Upon transition completion, the character's Actual Posture is compared against the latest Squad Posture Intent. If Actual Posture differs from latest Squad Posture Intent, whether a subsequent transition may begin is reevaluated under the canonical rules applicable at that time.

### Semantic Gap Lineage: GAP-GS-001
* **Portion Resolved by T-009**: Defined global Squad Posture Intent, individual actual posture distinction, transition atomicity, and completion-time intent reevaluation logic.
* **Remaining Unresolved Items**: Transition duration constants remain tracked under `GAP-GS-001`.

---

## GS-003: Firing Posture Invariant and Ammo-Depletion Auto-Cover
* **Domain**: Gameplay
* **Status**: Approved (Canonical)
* **Tags**: `combat`, `firing`, `posture`, `ammo`
* **Human Semantic Authorization**: Explicitly authorized by Human Owner under Guardrail G-041 (Task T-009).

### Specification
1. **Firing Posture Invariant**:
   * Weapon firing is strictly permitted only when the character is fully `EXPOSED`.
   * Firing is prohibited while `COVERED`, `TRANSITIONING_TO_COVERED`, or `TRANSITIONING_TO_EXPOSED`.
   * When a transition to `EXPOSED` completes, firing eligibility is reevaluated.

2. **Ammo Depletion Auto-Cover**:
   * When an `EXPOSED` character fires the final round from their magazine (magazine ammo reaches 0):
     * Active firing ends immediately.
     * The character automatically begins transition toward `COVERED` (`TRANSITIONING_TO_COVERED`).
     * The global Squad Posture Intent is **not** modified.

3. **Ammo-Depletion Reload Return**:
   * After the automatic ammo-depletion cover transition completes, reload proceeds in `COVERED` according to rule `GS-004`.
   * When reload completes in `COVERED`:
     * If latest Squad Posture Intent is `WANT_EXPOSED`: character automatically begins transition toward `EXPOSED`.
     * If latest Squad Posture Intent is `WANT_COVERED`: character remains in `COVERED` posture.

### Semantic Gap Lineage: GAP-GS-002 & GAP-GS-004
* **Portion Resolved by T-009**: Established strict exposure invariant for firing, ammo depletion trigger, automatic cover transition, and reload-completion return routing based on Squad Posture Intent. Ammo exhaustion is formally retired as an independent top-level combat state.
* **Remaining Unresolved Items**:
  * `GAP-GS-002`: Rate of fire, fire interval, projectile vs. hitscan resolution, recoil timing, ammo consumption per shot, and magazine capacities.
  * `GAP-GS-004`: Weapon-specific firing cycle re-entry cadence upon returning to `EXPOSED` (cadence preservation vs. immediate cycle reset).

---

## GS-004: Cover-Triggered Reload, Cancellation and Resumption
* **Domain**: Gameplay
* **Status**: Approved (Canonical)
* **Tags**: `combat`, `reload`, `cancellation`, `stun`
* **Human Semantic Authorization**: Explicitly authorized by Human Owner under Guardrail G-041 (Task T-009). Reload cancellation target state authorized under Guardrail G-041 (Task T-018).

### Specification
1. **Cover-Triggered Reload Condition**:
   * Reload begins automatically when all of the following conditions are simultaneously satisfied:
     * The character is actionable (not stunned or control-restricted).
     * The character is fully `COVERED` (reload does not start during `TRANSITIONING_TO_COVERED`).
     * The weapon magazine is not full.
     * The character is not already `RELOADING`.
   * If the magazine is already full upon entering or holding in cover, `COVERED + READY` is maintained.

2. **Reload Cancellation**:
   * If a character begins transitioning from `COVERED` toward `EXPOSED` (`TRANSITIONING_TO_EXPOSED`) while `RELOADING`:
     * Reload is **cancelled immediately**.
     * Weapon Action immediately transitions to `READY`.
     * Incomplete reload progress is discarded (not preserved).
     * Zero ammunition is granted to the magazine.
   * If a character receives `STUN` while `RELOADING`:
     * Reload is **cancelled immediately**.
     * Weapon Action immediately transitions to `READY`.
     * Incomplete reload progress is discarded.
     * Zero ammunition is granted.
   * Invariant: Reload is never merely paused; an interrupted reload is fully cancelled.
   * **Authority Boundary for Post-Cancellation READY**:
     * `READY` after reload cancellation denotes strictly that the weapon is no longer `FIRING` or `RELOADING`.
     * `READY` does **not** imply:
       * firing permission
       * ammunition availability
       * global actionability
       * absence of `STUN`
       * satisfaction of posture prerequisites

3. **Post-STUN Reload Resumption**:
   * If `STUN` expires while:
     * The character is in `COVERED` posture,
     * The magazine remains incomplete, and
     * The character becomes actionable,
   * Then a **new reload begins from the start** under the canonical covered reload invariant.

### Semantic Gap Lineage: GAP-GS-003
* **Portion Resolved by T-009**: Established reload as a Weapon Action, automatic cover-triggered entry invariant, cancellation semantics upon uncovering or stun (no progress preservation, zero ammo gained), and post-stun restart conditions.
* **Portion Resolved by T-018**: Established explicit post-cancellation Weapon Action target state (`READY`) for uncover-triggered and STUN-triggered reload cancellation with explicit authority boundary.
* **Remaining Unresolved Items**: Exact reload duration in simulation time, whether manual reload input exists, and reserve ammunition rules remain open pending domain specification.

---

## GS-005: STUN as Orthogonal Control State
* **Domain**: Gameplay
* **Status**: Approved (Canonical)
* **Tags**: `combat`, `control-state`, `stun`
* **Human Semantic Authorization**: Explicitly authorized by Human Owner under Guardrail G-041 (Task T-009).

### Specification
1. **Orthogonal Control State**:
   * `STUN` is an independent Control State representing crowd-control incapacity; it is **not** a Posture.
   * Valid orthogonal state combinations include:
     * `COVERED + STUNNED`
     * `EXPOSED + STUNNED`
     * `TRANSITIONING_TO_COVERED + STUNNED`
     * `TRANSITIONING_TO_EXPOSED + STUNNED`

2. **Interruption and Non-Interruption Boundaries**:
   * Receiving `STUN` **stops/interrupts** active `FIRING`.
   * Receiving `STUN` **cancels** active `RELOADING` (with zero ammunition granted and zero progress preserved).
   * Receiving `STUN` does **not** cancel, abort, or pause an ongoing posture transition; the transition continues to completion.
   * *(Note: STUN interaction with Charge Sessions is deferred to the future Weapon / Charge semantic slice).*

3. **Expiration & Control Evaluation**:
   * When `STUN` expires, `STUN` itself no longer prevents the character from acting. Overall actionability is reevaluated under the currently applicable canonical control rules.
   * Ongoing posture is preserved, and state transitions or reloads proceed according to canonical invariants (such as restarting reload if covered with an incomplete magazine under `GS-004`).

### Semantic Gap Lineage: GAP-GS-005
* **Portion Resolved by T-009**: Established STUN as an independent control state orthogonal to posture, defined interruption of firing and cancellation of reload, and non-interruption of posture transitions.
* **Remaining Unresolved Items**: Exact stun duration in simulation time, multiple-STUN interactions (stacking vs. refresh vs. overwrite), and STUN interaction with Charge Sessions remain tracked under `GAP-GS-005`.

---

## GS-009: Controlled Character & Auto-Fire Preference
* **Domain**: Gameplay
* **Status**: Approved (Canonical)
* **Tags**: `combat`, `squad`, `control`, `auto-fire`
* **Human Semantic Authorization**: Explicitly authorized by Human Owner under Guardrail G-041 (Task T-009).

### Specification
1. **Controlled Character Routing**:
   * Exactly five characters participate in combat.
   * Exactly one character is designated as the **Controlled Character**.
   * Changing the Controlled Character:
     * Switches direct player input routing to the newly selected character.
     * Changes which character the account-scoped Auto-Fire preference applies to.
     * Does **not** reset or alter HP, ammo, posture, Weapon Action, status effects, or any other combat state of any character.

2. **Account-Scoped Auto-Fire Preference**:
   * Auto-Fire ON/OFF is an account-scoped preference persisted outside the Combat Domain.
   * Within combat:
     * The stored preference applies strictly to the current Controlled Character.
     * All uncontrolled characters operate with effective `AUTO_FIRE_ON` regardless of the account preference.
     * Switching control (e.g. from character C to E) causes E to receive the stored preference, while C assumes effective `AUTO_FIRE_ON`.

3. **Auto-Fire Intent vs. Actual Firing**:
   * Effective Auto-Fire intent and the actual `FIRING` weapon action are distinct concepts.
   * If effective Auto-Fire intent is ON:
     * Being `COVERED` does not turn the intent OFF.
     * Being `STUNNED` does not turn the intent OFF.
     * Actual firing remains prohibited whenever firing invariants (such as requirement for fully `EXPOSED` posture under `GS-003` or non-stunned status under `GS-005`) are not satisfied.

4. **Auto-Fire Across STUN**:
   * `STUN` does not modify the account-scoped Auto-Fire preference or effective Auto-Fire intent.
   * When `STUN` expires:
     * If the character is `EXPOSED`, effective Auto-Fire is ON, and firing conditions permit, firing eligibility is reevaluated immediately.
     * If the character is `COVERED`, effective Auto-Fire intent may remain ON, but actual firing does not begin.
   * *(Note: Weapon-specific firing cycle cadence upon re-exposure is not defined in T-009 and remains deferred).*

### Semantic Gap Lineage: GAP-GS-002
* **Portion Resolved by T-009**: Established squad control routing invariance, account-scoped preference routing, separation of auto-fire intent from firing action, and auto-fire intent preservation across stun.
* **Remaining Unresolved Items**: Weapon-specific firing cadence and fire rate metrics remain tracked under `GAP-GS-002`.
