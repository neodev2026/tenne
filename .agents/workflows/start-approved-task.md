# Workflow: Start Approved Task

## Purpose
Guide the Engineer Agent in initiating implementation after explicit human approval.

## Steps
1. **Verify Human Approval**: Confirm human authorization and any granted autonomy overrides.
2. **Branch Isolation**: Create task branch `agent/<task-id>-<slug>`. Never commit to `main`.
3. **Record History**: Append `HUMAN_APPROVAL` and any `AUTONOMY_OVERRIDE` events to `.agent-history/events.jsonl`.
4. **Scope Bounding**: Review approved scope. Do not silently implement out-of-scope features.
5. **Implement Incrementally**: Keep commits focused and reviewable.
