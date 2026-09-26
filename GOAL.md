# TENNE Product Goal

## Product Goal

Build TENNE, a browser-playable combat game inspired by the structural ideas of cover-based squad shooters.

TENNE must be playable directly from a public URL without requiring installation.

The project must use original or placeholder assets and must not copy proprietary characters, names, artwork, music, UI, source code, or other copyrighted assets from existing commercial games.

## Engineering Goal

TENNE is also an experiment in controlled software-agent autonomy.

The core research question is:

> How far can we expand an agent's development loop while keeping its decisions understandable, its work verifiable, and the trusted codebase under meaningful human control?

Agents should gradually become capable of:

1. understanding the product goal,
2. inspecting the current project state,
3. identifying gaps,
4. proposing the next useful task,
5. classifying the task,
6. discovering only the relevant semantic context and skills,
7. implementing an approved task,
8. verifying the result,
9. correcting failures,
10. preparing a pull request,
11. recommending what should happen next.

Agent autonomy must grow only when sufficient evidence, observability, verification, and guardrails exist.

## Trust Model

`main` represents the Human-Trusted State of TENNE.

Agents work on isolated branches.

Agents may propose and implement work within their current autonomy permissions, but they may not merge their own work into `main`.

Human review decides what becomes trusted project state.

## Initial Autonomy

The project starts at Autonomy Level L1.5.

The initial autonomy window is:

> One human-approved task.

Before task approval, an agent may analyze, classify, discover context, and propose work.

After approval, an agent may implement the task, test it, fix failures, verify it, and prepare a pull request.

The agent may not automatically start the next task.

The agent may not merge to `main`.

## Product Success Criteria

TENNE should eventually provide:

- a public browser-playable game,
- a deterministic and testable gameplay core,
- a visible progression from product goal to implemented features,
- a reusable Agent Harness,
- an Agent Journey interface that explains how the project evolved.

## Agent Journey Goal

The Agent Journey must allow a human to quickly understand:

- what the agent did,
- why it did it,
- which semantic rules it relied on,
- which skills and context it selected,
- which guardrails applied,
- how the work was verified,
- where failures occurred,
- where humans approved, rejected, or changed the work,
- why autonomy was increased or reduced.

Agent explanations and system evidence must remain distinguishable.

## Semantic Layer Principle

Important TENNE meanings must not live only in prompts.

Shared product, gameplay, architecture, and engineering meaning belongs in the Semantic Layer.

Agents must not invent missing product semantics.

When required meaning is undefined, the agent must identify a Semantic Gap and request human judgment.

## Guardrail Principle

Guardrails exist to make larger autonomy windows safer.

A guardrail should protect meaningful risks rather than merely adding process.

Repeated human corrections should, when appropriate, move left into:

human feedback
-> semantic rule
-> skill guidance
-> deterministic verification
-> guardrail

Guardrails themselves remain subject to human review.

## Documentation Principle

Human-facing core documentation must be available in:

- English,
- Korean,
- German.

English is the canonical technical source.

Korean exists primarily for fast owner judgment.

German exists primarily for German-speaking interviewers and developers.

Machine-oriented operational material remains English-only unless there is a concrete reason otherwise.

## Bootstrap Constraint

The first task is T-000 Harness Bootstrap.

T-000 must build the minimum environment required for future goal-driven agent work.

T-000 must NOT implement gameplay features.

After T-000 is merged, the human should be able to ask:

> Review the current product goal and project state. Identify the highest-value gap and propose the next task. Do not begin implementation.

The agent must then propose T-001 and stop for human approval.
