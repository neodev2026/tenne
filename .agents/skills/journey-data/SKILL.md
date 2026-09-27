---
name: journey-data
description: Manages append-only historical audit events and compiles sanitized public Journey data.
---

# Journey Data Skill

## Intent
Maintain historical facts and compile read-only public Journey visualizations while protecting private system paths.

## Guidelines
1. Log all significant milestones, task proposals, approvals, runs, and Git facts to `.agent-history/events.jsonl`.
2. Strictly separate machine-verified `systemFacts` from subjective `agentExplanations`.
3. Never erase or overwrite failed attempts.
4. Run `npm run generate:journey` to export sanitized events to `public/generated/journey/journey-data.json`.
