# Workflow: Prepare Pull Request

## Purpose
Prepare a reviewable Pull Request candidate for human review.

## Steps
1. **Summarize WHAT / WHY / HOW**: Provide clear technical and product context.
2. **Compile Evidence**: Attach raw command exit codes, test logs, and guardrail audit status.
3. **Inspect Candidate State Projection (Side-Effect-Free)**: Run `node scripts/generate-project-state-candidate.mjs --stdout` to review the candidate project state projection on stdout without writing an untracked file to the working tree. (Note: Avoid write-producing invocations during PR preparation so `git status --porcelain` remains clean and G-031 file accounting is unaffected).
4. **Preserve Trust Boundaries**: Do not commit to `main`. Do not assume candidate state is trusted.
5. **Recommend Post-Merge Evaluation**: Remind human reviewer that Manager Agent will re-read trusted state after merge to formulate the next task.
6. **Halt**: Await human review and merge.
