# TENNE Architecture Semantics: Simulation Time and Event Processing

> [!IMPORTANT]
> **Human Semantic Authorization (Guardrail G-041)**:
> The architecture semantics defined in this specification (`AS-005` and `AS-006`) are established by explicit Human Owner decision under Guardrail G-041 (Task T-010).
>
> In accordance with project governance, concrete integer time units (milliseconds, ticks, frames, microseconds) and cascade bounding parameters are not invented by agents; remaining unresolved items are formally tracked under explicit Semantic Gap identifiers (`GAP-AS-005` and `GAP-AS-006`).

---

## AS-005: Deterministic Simulation Time & Chronological Progression
* **Domain**: Architecture
* **Status**: Approved (Canonical)
* **Tags**: `architecture`, `simulation`, `time`, `deterministic`
* **Human Semantic Authorization**: Explicitly authorized by Human Owner under Guardrail G-041 (Task T-010).

### Specification

1. **Explicit Integer Representation**:
   * Combat simulation time is represented using an explicit integer representation.
   * Simulation truth is completely decoupled from and does not directly depend on:
     * wall-clock time
     * rendering framerate
     * rendering progress
     * browser timing (such as `requestAnimationFrame`, `setTimeout`, or `setInterval`)
     * real-time asynchronous scheduling

2. **Conceptual Progression**:
   * Conceptual domain progression may be expressed as:
     `advanceTo(targetSimulationTime)`
   * Pending scheduled events up to the target simulation time are processed chronologically according to canonical event ordering (see `AS-006`).

3. **Temporal Boundary Scope**:
   * Whether simulation-time progression is monotonic, and whether backward-time or rewind behavior is permitted, is not canonicalized by this rule.
   * Inclusive/exclusive behavior for events scheduled exactly at the current simulation timestamp is not canonicalized by this rule and remains an open operational detail.

### Semantic Gap Lineage: GAP-AS-005
* **Portion Resolved by T-010**: Established explicit integer time representation, complete detachment from presentation/browser/wall-clock timing, conceptual `advanceTo()` progression, and chronological event processing.
* **Remaining Unresolved Items**: The exact physical unit or resolution of 1 integer unit (e.g. whether 1 integer unit represents a millisecond, tick, microsecond, frame, or other concrete resolution) remains an open domain specification tracked under `GAP-AS-005`. Agents must not invent concrete time units.

---

## AS-006: Canonical Event Precedence, Snapshot Isolation & Wave Execution
* **Domain**: Architecture
* **Status**: Approved (Canonical)
* **Tags**: `architecture`, `event-ordering`, `event-waves`, `effect-intents`, `snapshot-isolation`
* **Human Semantic Authorization**: Explicitly authorized by Human Owner under Guardrail G-041 (Task T-010).

### Specification

1. **Same-Timestamp Canonical Precedence**:
   * When multiple event categories occur or are scheduled at the exact same simulation timestamp, the canonical processing order is strictly:
     1. `Hard Interrupt / Control`
     2. `Scheduled Completion / State Transition`
     3. `Player Input`
     4. `Derived Events`
     5. `Skill Trigger / Activation`
     6. `Effect Resolution`
   * This precedence hierarchy is semantic. Precedence categories must not be reordered, collapsed, or augmented with unapproved categories. Additional precedence within categories must not be inferred unless already established canonically elsewhere.

2. **Deterministic Event Waves & Snapshot Isolation**:
   * Event processing occurs through discrete event waves.
   * Within an event wave:
     * Sibling trigger evaluation within a wave uses the same pre-wave state snapshot.
     * Sibling triggers do not observe state changes produced by sibling processing in that same wave.
     * Sibling skill/effect evaluation remains isolated during that wave.

3. **Effect Intents**:
   * For effect-producing logic:
     * Proposed effects are represented as Effect Intents rather than immediately mutating shared state during evaluation.
     * Effect Intents do not directly mutate shared state during evaluation.
     * Sibling effects in the same wave are evaluated without observing sibling committed effects.
     * Effect Intents are resolved under canonical resolution rules.
     * The resolved results are committed atomically to shared domain state at wave conclusion.
   * **Effect Intent Boundary**:
     * Effect Intents apply strictly to effect-producing logic.
     * Effect Intents are **not** an unapproved universal mutation mechanism for every combat state change.
     * STUN cancellation, posture transitions, reload cancellations, and general combat transitions are not mandated to be Effect Intents; no universal mutation mechanism has been approved.

4. **Wave-Deferred Derived Events**:
   * Events derived from committed results are not recursively processed inside the same wave.
   * Derived events become inputs to the next wave.
   * The next wave observes the state committed by the previous wave.
   * (Concrete queue data structures or specific collection mechanisms are implementation choices and are not mandated by this semantic rule).

5. **Bounded Cascades Invariant**:
   * Event cascades are permitted.
   * Event cascades must be deterministically bounded so that malformed or cyclic semantic chains cannot process indefinitely.

6. **Compatibility with T-009 Combat Semantics**:
   * Approved combat semantics (`GS-001` through `GS-005`, and `GS-009`) remain unchanged and authoritative.
   * The word "immediately" in existing combat semantics represents semantic ordering that is not delayed by rendering, animation progress, framerate, or wall-clock timing.
   * No unapproved implementation mechanism is attached to "immediately."

### Semantic Gap Lineage: GAP-AS-006
* **Portion Resolved by T-010**: Established the exact 6-tier same-timestamp precedence hierarchy, discrete event waves, pre-wave snapshot isolation, Effect Intent staging and atomic commit for effect-producing logic, wave-deferred derived events, and mandatory cascade bounding.
* **Remaining Unresolved Items**:
  * Exact cascade bound and numerical threshold.
  * What the bound counts (whether it counts waves, events, derived-event generations, or another deterministic unit).
  * Overflow/failure behavior when the bound is exceeded.
  * All of the above remain open domain specifications tracked under `GAP-AS-006`. Agents must not invent cascade thresholds or failure policies.
  * Effect-domain numerical formulas, stack rules, refresh rules, overwrite rules, aggregation rules, and buff/debuff priority formulas remain deferred.
