# TENNE Architecture Semantics

## AS-001: Gameplay and Rendering Separation
* **Domain**: Architecture
* **Status**: Approved
* **Tags**: `architecture`, `domain`, `phaser`, `rendering`
* **Specification**: Core gameplay logic must be completely isolated from the presentation rendering engine (e.g., Phaser, Canvas, WebGL). Gameplay domain logic lives in `src/game/domain/` and never directly imports rendering libraries.

## AS-002: Combat State Ownership
* **Domain**: Architecture
* **Status**: Approved
* **Tags**: `architecture`, `state-machine`, `state`
* **Human Semantic Authorization**: Explicitly authorized by Human Owner under Guardrail G-041 (Task T-009 bootstrap; Task T-025 Application Multi-Axis Combat State Coordination Boundary).

### Specification
1. **Canonical Combat State Ownership**:
   * Combat state (positions, ammo, health, status effects) is strictly owned and mutated by the deterministic domain state machine.
   * Presentation components only read domain state or dispatch player intent commands.

2. **Application Multi-Axis Combat State Coordination Boundary**:
   * **Coordination Container Pattern**:
     * An Application-layer coordination container pattern is authorized for orchestration scenarios where one canonical Domain response updates multiple independent Domain state axes (such as `AmmoDepletionResponse` updating `WeaponActionState` and `CharacterPostureState` simultaneously under rule `GS-003 §2`).
     * This Application coordination container is **not** canonical Domain ownership. It is an Application-level orchestration snapshot / aggregate holding references to canonical Domain state values, providing a coherent container for multi-axis state replacement. It does not declare or imply that `WeaponActionState`, `MagazineAmmoState`, STUN, or other combat axes are structurally owned by `Character` at the Domain level.
   * **Minimum Coordinated Axes for Ammo Depletion**:
     * For the immediate ammo-depletion use case, the coordination container is strictly authorized to hold only the minimum coordinated axes:
       1. `CharacterPostureState`
       2. `WeaponActionState`
     * The coordination container must **not** include `MagazineAmmoState` at this time.
     * The coordination container must **not** include STUN or control status at this time.
     * The coordination container must **not** include `SquadPostureIntent` (global squad intent is independent under `GS-002` and invariant under `GS-003 §2`).
     * This specification does **not** define a universal `Character` aggregate.
   * **Copy-on-Write Reference Replacement & In-Memory Atomicity**:
     * The Application coordination pattern must use immutable, copy-on-write whole-container replacement:
       $$\text{old coordination snapshot} \longrightarrow \text{construct complete next snapshot} \longrightarrow \text{replace reference}$$
     * The Application layer must never perform field-by-field sequential mutation (e.g., mutating posture and subsequently mutating weapon action).
     * The complete next multi-axis snapshot must be constructed before replacing or exposing the reference, ensuring that Application readers/observers never witness an invalid partial transition (such as `FIRING` + `TRANSITIONING_TO_COVERED` or `IDLE` + `EXPOSED`).
     * **Explicit Non-Guarantees**: This guarantee is strictly an in-memory Application reference-replacement guarantee in a single-threaded runtime. It is **not** database transactional atomicity, ACID, rollback, distributed consensus, or concurrency/version-control semantics.
   * **Session Isolation (PostureDemoSession Preservation)**:
     * `PostureDemoSession` established in `T-015` remains strictly posture-only and unchanged.
     * `PostureDemoSession` must **not** be expanded into a general combat session.
     * Any future combat-oriented Application session or container must be architecturally separate unless explicitly authorized by a subsequent human decision.
   * **EventBatch & EffectIntent Non-Integration**:
     * `EventBatch` is a Domain evaluation-wave kernel for same-timestamp peer events (`AS-005`, `AS-006`); its peer events carry no semantic ordering. Because `resolveAmmoDepletionResponse` already produces an immutable coordinated pair, `EventBatch` is **not** the Application integration mechanism for ammo depletion. Splitting the response into peer events would weaken the canonical coordination guarantee.
     * In accordance with rule `AS-006 §3`, `EffectIntent` applies strictly to effect-producing evaluation logic and is **not** an authorized universal mutation or Application coordination mechanism.
   * **Stale-Response Risk & Design Direction**:
     * A precomputed `AmmoDepletionResponse` value object could become stale if held and applied after intervening character state changes (e.g., receiving STUN or external interrupts).
     * To mitigate this architectural risk, the preferred future Application design direction is for the Application operation to resolve the Domain response and construct the replacement coordination snapshot within one synchronous orchestration operation, rather than exposing a long-lived precomputed response for decoupled application.
     * Agents must **not** invent version numbers, sequence IDs, compare-and-swap (CAS), locks, concurrency frameworks, or retry/idempotency frameworks.
   * **Naming Conventions**:
     * Canonical architecture does not mandate the public implementation name `CharacterCombatState`.
     * Architectural documentation references this construct as an *Application multi-axis combat coordination snapshot* or *Application combat coordination container*. Concrete TypeScript naming remains an implementation-layer choice.

### Architectural Gap Lineage & Boundaries
* **Portion Resolved by T-025**: Authorized the Application multi-axis combat state coordination container pattern; established the copy-on-write reference replacement rule; bounded the coordinated axes strictly to `CharacterPostureState` and `WeaponActionState` for ammo depletion; preserved `PostureDemoSession` isolation; confirmed `EventBatch` and `EffectIntent` non-integration; identified the stale-response architectural risk and synchronous design direction.
* **Remaining Unresolved Items**:
  * *Structural Ownership Decomposition*: The structural ownership decomposition between character and weapon states at the Domain level remains unresolved (as noted in Domain line 1011).
  * *Stale-Response Failure Policy*: Concrete failure behavior when applying a stale response (whether the Application layer throws an Error, returns false, no-ops, or emits an event) is not authorized by this specification and remains unresolved.
  * *Additional Axes Expansion*: Inclusion of `MagazineAmmoState`, STUN/control status, and squad membership in Application aggregates remains deferred.
  * *Combat Session Architecture*: Architecture and lifecycle of a multi-character combat session remain deferred.

## AS-003: Rendering Cannot Define Gameplay Truth
* **Domain**: Architecture
* **Status**: Approved
* **Tags**: `architecture`, `rendering`, `gameplay-state`
* **Specification**: Visual animations, framerates, particles, or screen dimensions must never dictate gameplay outcome. If rendering drops frames or freezes, the underlying simulation remains intact and authoritative.

## AS-004: Gameplay Logic Must Be Testable Without Browser
* **Domain**: Architecture
* **Status**: Approved
* **Tags**: `architecture`, `testing`, `domain`
* **Specification**: All domain state machines, damage calculations, and combat transitions must execute headlessly in pure Node.js/Vitest without requiring a browser window, DOM API, or WebGL context.
