# Workflow: Verify Task

## Purpose
Guide the Verification Agent in independently verifying task completion using deterministic system evidence.

## Steps
1. **Execute Unified Verification**: Run `npm run verify`.
2. **Collect Evidence**: Capture exit codes, test outputs, lint results, and build artifacts.
3. **Audit Guardrails**: Execute `npm run check:guardrails` and check compliance against `guardrails/registry.json`.
4. **Preserve Failures**: Never conceal failed runs. Record failures, diagnosis, and fix history in `.agent-history/events.jsonl`.
5. **Browser Smoke Check**: For UI/web tasks, verify that web routes load without uncaught runtime errors.
