import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUTPUT_FILE = path.join(ROOT, 'PROJECT_STATE.candidate.md');

function generateCandidateState() {
  const content = `# TENNE Project State (Candidate)

> [!IMPORTANT]
> **Candidate State for Task T-000 Review.**
> This file reflects proposed project state upon successful human merge of branch \`agent/t-000-harness-bootstrap\`.
> In accordance with the TENNE Trust Model, promotion of candidate state to canonical \`PROJECT_STATE.md\` is an explicit human-controlled action.

## Current Goal
GOAL-001
Build a browser-playable TENNE combat game while experimenting with controlled software-agent autonomy.

## Current Phase
Harness Bootstrap Completed

## Current Milestone
M-000 - Agent Development Environment (Foundation Established)

## Completed Tasks
- **T-000**: Harness Bootstrap
  - Status: VERIFIED_PR_CANDIDATE
  - Origin: HUMAN_SEEDED
  - Deliverables:
    - Vite multi-page application with shells for \`/\`, \`/play/\`, and \`/journey/\`
    - Agent Journey UI (React + TypeScript) backed by append-only audit stream
    - Game layer separation (\`src/game/domain\`, \`src/game/application\`, \`src/game/presentation\`) with zero Phaser
    - Semantic Layer stubs and explicit Semantic Gaps
    - Guardrail Registry with 18 approved rules and automated checking
    - Unified verification orchestrator (\`npm run verify\`)
    - Multilingual documentation hierarchy (EN, KO, DE)
    - GitHub Actions CI/CD workflows

## Current Autonomy
L1.5 - One Approved Task
- Active Window: Task T-000 completed.
- Next Action: Standby for human review and merge.

## Trusted State Post-Merge
Following human merge to \`main\` and promotion of this candidate state:
1. Canonical \`PROJECT_STATE.md\` is updated.
2. Manager Agent re-reads trusted state and \`GOAL.md\`.
3. Manager Agent identifies highest-value gap and proposes Task T-001.
4. Agent halts with \`WAITING FOR HUMAN APPROVAL\`.

Generated At: ${new Date().toISOString()}
`;

  fs.writeFileSync(OUTPUT_FILE, content, 'utf-8');
  console.log(`[generate-candidate] Successfully generated ${OUTPUT_FILE}`);
}

generateCandidateState();
