# TENNE Engineering Semantics: Experiment Metrics

## EM-001: Experiment Metric Semantics & Evidence Boundaries
* **Domain**: Engineering
* **Status**: Approved
* **Tags**: `experiment`, `metrics`, `observability`, `governance`
* **Human Semantic Authorization**: Explicitly established by Human Owner decision under Guardrail G-041. Identifier `EM-001` (Experiment Metrics) is a deliberate human semantic decision establishing canonical measurement boundaries before automated instrumentation.

### Purpose & Research Context
TENNE is an empirical investigation into controlled software-agent autonomy guided by the core research question:
> *"How far can we expand an agent's development loop while keeping its decisions verifiable, understandable, and under meaningful human control?"*

To evaluate this question quantitatively without introducing misleading or speculative measurements, this specification establishes canonical definitions and evidence boundaries for all experiment metrics. Numerical metrics are not valid simply because they appear precise; metric semantics must be formally defined before instrumentation or telemetry collection begins.

---

### Class A — Deterministic Repository & CI Observations
Class A metrics possess durable, mechanically verifiable observation sources in the Git DAG, GitHub Actions workflow logs, or append-only audit records. They do not depend on human subjective interpretation.

#### 1. Budget-Counted Files Per Task
* **Definition**: The exact number of changed files evaluated against the Guardrail G-031 changed-file budget limit for an approved task.
* **Observation Source**: Evaluated via G-031 accounting logic (`guardrails/scripts/check-guardrails.mjs`).
* **Accounting Boundary**: Budget-counted file count is **distinct from physical Git diff file count** (`git status --porcelain` or `git diff --stat`) whenever exact-path accounting exclusions apply (specifically `.agent-history/verifications/latest-verification.log`).

#### 2. Implementation Commits Per Task Branch
* **Definition**: The total number of logical commits authored on the isolated task branch (`agent/*`) prior to human merge into `main`.
* **Observation Source**: Git commit graph (`git log origin/main..HEAD --oneline`).
* **Semantic Constraint**: `commit count != implementation cycle count`. Commits represent atomic reviewable save points on a branch, not the number of design, implementation, or correction cycles.

#### 3. Task-Branch CI Outcomes
* **Definition**: The discrete execution outcome of automated verification triggered by push events to isolated agent task branches.
* **Observation Source**: GitHub Actions `verify.yml` workflow runs on branches matching `refs/heads/agent/*`.
* **Values**: `SUCCESS`, `FAILURE`, `CANCELLED`.

#### 4. Pull Request CI Outcomes
* **Definition**: The discrete execution outcome of automated verification triggered by candidate pull requests targeting `main`.
* **Observation Source**: GitHub Actions `verify.yml` workflow runs on event `pull_request`.
* **Values**: `SUCCESS`, `FAILURE`, `CANCELLED`.

#### 5. Main-Push CI Outcomes
* **Definition**: The discrete execution outcome of automated verification triggered by human merge or direct push to `main`.
* **Observation Source**: GitHub Actions `verify.yml` workflow runs on event `push` targeting `refs/heads/main`.
* **Values**: `SUCCESS`, `FAILURE`, `CANCELLED`.
* **Evidence Invariant**: Real push-to-main CI failures (such as the verified failure following T-001 merge) are vital empirical evidence demonstrating execution-context boundaries. Completed task cycles must never be collapsed into a false "100% success rate" narrative.

#### 6. Production Deployment Outcomes
* **Definition**: The discrete execution outcome of the automated static production deployment pipeline to GitHub Pages.
* **Observation Source**: GitHub Actions `deploy.yml` workflow runs on `main`.
* **Values**: `SUCCESS`, `FAILURE`, `CANCELLED`.

#### 7. Approval-to-Merge Wall-Clock Duration
* **Definition**: The total elapsed wall-clock time between the recorded `HUMAN_APPROVAL` timestamp in `.agent-history/events.jsonl` and the merge commit timestamp on `main`.
* **Observation Source**: `.agent-history/events.jsonl` approval event timestamp compared against Git merge commit commit-date.
* **Semantic Constraint**: `approval-to-merge duration != agent execution time`. This duration measures total elapsed real-world time and inevitably incorporates human reviewer latency, queueing delays, and idle time; it must never be represented as active agent execution runtime.

#### 8. Project Governance Gate Events
* **Definition**: Discrete, durable governance transitions required by TENNE trust rules before state transitions become trusted.
* **Observation Source**: Append-only event stream (`.agent-history/events.jsonl`), Git merge commits, and GitHub pull request records.
* **Gate Types**:
  * `HUMAN_APPROVAL`: Explicit authorization of a task proposal and scope under Autonomy L1.5.
  * `HUMAN_MERGE`: Manual human merge of a task branch PR into `main`.
  * `G-041_AUTHORIZATION`: Explicit human authorization for Semantic Layer modifications.
  * `G-042_AUTHORIZATION`: Explicit human authorization for Guardrail modifications.

---

### Class B — Human-Labeled Observations
Class B metrics capture critical aspects of agent behavior and autonomy friction that require explicit human qualitative evaluation and cannot be derived deterministically from raw logs.

#### 1. Corrective Human Intervention
* **Definition**: An explicit human action that alters, redirects, or repairs agent output due to an error, invalid assumption, scope creep, or false verification claim.
* **Examples**:
  * Correcting agent reasoning during task proposal review.
  * Mandating scope reduction or removing unauthorized files.
  * Rejecting an implementation approach or requiring an additional implementation cycle.
  * Repairing an unsupported or inaccurate verification claim.
* **Boundary Rule**: Standard scheduled protocol gates (such as routine task approval or final PR merge) are normal governance transitions and must **NOT** be counted as corrective interventions.

#### 2. Substantive PR Review Finding
* **Definition**: A concrete issue identified during human pull request review that materially impacts correctness, governance compliance, verification truthfulness, scope bounding, or trust boundaries.
* **Classification Criteria**: Distinct from minor conversational feedback or optional future ideas; represents an issue that required resolution before merge.

#### 3. Agent Self-Report vs. Deterministic-Evidence Mismatch
* **Definition**: An observed defect where an agent claims a property, pass state, or guarantee that available deterministic system evidence does not prove.
* **Example Category**: Verifier labeling or agent explanations claiming a stronger property than the underlying automated mechanism proves (e.g. claiming "Translation Parity" when the tool only proves file existence).
* **Constraint**: Historical instances must be classified according to documented evidence; no speculative backfill is permitted.

---

### Class C — Currently Unsupported / Ambiguous Observations
Class C represents metrics that must **NOT** currently be reported or tracked as quantitative values because durable observation mechanisms or canonical definitions do not yet exist.

#### 1. Local Verification Failure Count
* **Status**: `UNSUPPORTED`
* **Reason**: Iterative local verification runs and test failures during active development on developer workstations are ephemeral and are not durably, completely recorded in Git or audit logs.

#### 2. Agent-Completed Workflow Step Count
* **Status**: `AMBIGUOUS`
* **Reason**: TENNE does not currently define a formal, machine-verifiable unit of measure for what constitutes a single "step" across heterogeneous agent workflows.

#### 3. Tool-Level Permission Prompt Count
* **Status**: `UNSUPPORTED / NON-GOVERNANCE`
* **Reason**: Operational tool dialogs (such as shell "Allow" prompts or IDE file-write confirmations) are transient environment conveniences of external agent runners. They are not repository governance events.

---

### Governance Gates vs. Tool-Level Operational Permissions
A strict semantic boundary exists between institutional governance and runner tooling:

```
[Project Governance Gates]                   [Tool-Level Operational Permissions]
• Human Task Approval (L1.5)                 • Shell command execution prompts
• Human Pull Request Merge                   • File write / edit dialogs
• G-041 Semantic Layer Authorization         • External UI interaction confirmations
• G-042 Guardrail Change Authorization
─────────────────────────────────────        ─────────────────────────────────────
Answers: "Was this work authorized           Answers: "Did the local execution
          to enter Human-Trusted State?"               environment permit this tool?"
```

* **Project Governance Gates** reflect the institutional trust architecture of TENNE. They govern the promotion of unverified agent work into Human-Trusted `main`.
* **Tool-Level Operational Permissions** reflect the ergonomic security prompts of the host execution environment.
* **Invariant**: These categories answer completely different questions and must **never be combined** into a single aggregated "human intervention" metric.
