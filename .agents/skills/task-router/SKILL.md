---
name: task-router
description: Classifies tasks, maps semantic domains, and selects minimal operational skills and context.
---

# Task Router Skill

## Intent
Route incoming work by domain and select only relevant context, preventing context bloat.

## Guidelines
1. Identify primary task domain: `product`, `gameplay`, `architecture`, `harness`, or `observability`.
2. Filter `semantic/index.json` for rules matching the task's domain tags.
3. Select only skills required for immediate execution.
4. If required domain semantics are absent, declare a Semantic Gap rather than guessing.
