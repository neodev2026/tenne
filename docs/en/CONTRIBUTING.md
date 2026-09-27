# Contributing to TENNE

## 1. Branch and Trust Policy
- `main` is the Human-Trusted State.
- All agent development must occur on isolated branches (`agent/*`). Direct commits or pushes to `main` are strictly prohibited (Guardrail `G-002`).

## 2. Pull Request Contract
Every PR must contain:
1. **WHAT**: Precise description of modified files and functionality.
2. **WHY**: Alignment with milestone and product goals.
3. **HOW**: Technical implementation details, architecture boundaries, and tests.
4. **Evidence**: Command outputs, exit codes, and test results from `npm run verify`.
5. **Candidate State**: A generated `PROJECT_STATE.candidate.md`.

## 3. Verification Commands
```bash
# Run full verification
npm run verify

# Verify translations
npm run check:translations

# Verify guardrails
npm run check:guardrails
```
