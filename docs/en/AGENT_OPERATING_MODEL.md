# TENNE Agent Operating Model

## 1. Operating Philosophy
TENNE combines a game product with an autonomous development harness. Agents operate inside explicit human trust boundaries. `main` is the Human-Trusted State. All agent work occurs on isolated branches (`agent/*`) and cannot be merged without human review.

## 2. Autonomy Calibration: Level L1.5
The autonomy window permits one human-approved task:
1. **Manager Agent**: Analyzes `GOAL.md` and trusted `PROJECT_STATE.md`, identifies the highest-value gap, formulates a task proposal, and halts with `WAITING FOR HUMAN APPROVAL`.
2. **Human Owner**: Approves, amends, or rejects the proposal.
3. **Engineer Agent**: Checks out an isolated branch, implements the approved scope, writes tests, and runs verification.
4. **Verification Agent**: Evaluates system evidence independently of agent self-reporting.
5. **Pull Request**: Submitted for human review alongside a `PROJECT_STATE.candidate.md`.

## 3. Semantic Layer & Guardrails
- **Semantic Layer**: Domain rules are codified in `semantic/`. Undefined rules are tracked as Semantic Gaps.
- **Guardrails**: Protect against destructive commands, scope creep, and untested changes.
