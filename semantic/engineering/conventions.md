# TENNE Engineering Conventions

## EC-001: TypeScript Strictness
* **Domain**: Engineering
* **Status**: Approved
* **Tags**: `typescript`, `type-safety`
* **Specification**: All source files must compile with TypeScript strict mode enabled (`noImplicitAny`, `strictNullChecks`, `noUnusedLocals`, `noUnusedParameters`). Types must be explicit and accurately reflect domain state.

## EC-002: Descriptive Domain Naming
* **Domain**: Engineering
* **Status**: Approved
* **Tags**: `naming`, `domain`
* **Specification**: Variables, types, and functions must use descriptive, domain-aligned names (e.g., `CombatState`, `WeaponMagazine`, `SquadPosition`) rather than generic identifiers (`data`, `temp`, `manager`).

## EC-003: One Source of Truth
* **Domain**: Engineering
* **Status**: Approved
* **Tags**: `architecture`, `duplication`, `domain`
* **Specification**: Every product concept, domain rule, and state definition must have a single authoritative definition. Code must not duplicate state ownership or create competing canonical sources.

## EC-004: New State Transition Requires Test
* **Domain**: Engineering
* **Status**: Approved
* **Tags**: `testing`, `state-machine`, `verification`
* **Specification**: Any modification or addition to state machines or transition pathways must be accompanied by deterministic automated tests demonstrating both successful transition and guard against illegal transition.

## EC-005: Small Logical Change
* **Domain**: Engineering
* **Status**: Approved
* **Tags**: `task-scope`, `reviewability`
* **Specification**: Work must be segmented into small, focused, reviewable tasks adhering to autonomy budgets (e.g. max 5 files unless an explicit bootstrap override is approved).

## EC-006: Explain Non-obvious Decisions
* **Domain**: Engineering
* **Status**: Approved
* **Tags**: `documentation`, `decision`, `traceability`
* **Specification**: Architectural decisions, tradeoffs, and non-trivial algorithms must be documented with explicit rationale in the code or pull request explanations.
