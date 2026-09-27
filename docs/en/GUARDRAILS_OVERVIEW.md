# TENNE Guardrails Overview

## 1. Safety and Verification Principle
Guardrails protect project integrity and enable safe expansion of agent autonomy. They represent operational boundaries that agents must respect.

## 2. Guardrail Categories
- **Safety (`G-001`, `G-002`)**: Block destructive shell commands and prevent direct modification of `main`.
- **Verification (`G-003`, `G-004`)**: Mandate that all unit tests and builds pass before PR readiness.
- **Gameplay (`G-020`)**: Prevent silent changes to approved gameplay semantics.
- **Autonomy (`G-030`, `G-031`)**: Enforce the one-task autonomy window and the 5-file change budget.
- **Approval (`G-040` - `G-042`)**: Require explicit human approval for new dependencies, semantic changes, and guardrail revisions.
- **Context & Observability (`G-052`, `G-060` - `G-066`)**: Prevent guessing semantic gaps and enforce history integrity, isolated branches, and translation sync.

## 3. Enforcement Semantics
- **BLOCK**: Deterministically halts the action or PR transition.
- **HUMAN_REVIEW**: Detects condition and stops for human approval.
- **WARN**: Surfaces diagnostic notices without breaking verification.
