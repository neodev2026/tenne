---
name: git-pr
description: Guides branch isolation, commit cleanliness, and pull request candidate preparation.
---

# Git PR Skill

## Intent
Enforce git safety boundaries, preserve branch isolation, and compile verifiable PR artifacts.

## Guidelines
1. Verify working on `agent/<task-id>-<slug>`.
2. Do not commit or push directly to `main` (Guardrail G-002).
3. Generate candidate state (`PROJECT_STATE.candidate.md`) without mutating canonical `PROJECT_STATE.md`.
4. Ensure commits include verified test evidence and reproducible lockfiles.
