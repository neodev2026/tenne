# Workflow: Propose Task

## Purpose
Guide the Manager Agent in formulating a new task proposal based on current product goals and trusted project state.

## Steps
1. **Inspect Human-Trusted State**: Read root `GOAL.md` and `PROJECT_STATE.md` on `main`.
2. **Identify Value Gap**: Compare current milestone deliverables with actual trusted state.
3. **Classify Work**: Determine domain (product, gameplay, architecture, harness, presentation).
4. **Context Discovery**: Select relevant Semantic Rules from `semantic/index.json` and operational skills from `.agents/skills/`.
5. **Estimate Risks & Guardrails**: Identify applicable guardrails in `guardrails/registry.json`.
6. **Formulate DoD**: Define objective, deterministic acceptance criteria.
7. **Halt for Human Review**: End proposal explicitly with `WAITING FOR HUMAN APPROVAL`.
