# TENNE Autonomy Model

## 1. Controlled Autonomy Spectrum
Agent autonomy in TENNE is calibrated along an empirical maturity scale from L0 (Manual Pair Programming) to L4 (Multi-Task Unsupervised Execution).

## 2. Current Calibration: Level L1.5
The project operates strictly at **Level L1.5**:
- Window size: **One human-approved task**.
- Permission boundary: Agents may inspect and propose work, but implementation begins only upon explicit human approval.
- Promotion rule: Autonomy increases only when accompanied by verified automated guardrails, test coverage, and historical evidence.

## 3. Left-Shifting Feedback
Repeated human corrections shift left:
`Human Feedback → Semantic Rule → Skill Guidance → Deterministic Verification → Guardrail`.
