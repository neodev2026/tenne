import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const CANONICAL_FILE = path.join(ROOT, 'PROJECT_STATE.md');
const OUTPUT_FILE = path.join(ROOT, 'PROJECT_STATE.candidate.md');

export const CANDIDATE_REVIEW_ENVELOPE = `# TENNE Project State (Candidate Review Projection)

> [!IMPORTANT]
> **Derived Review Projection — Not Independently Authoritative.**
> This document is generated from \`PROJECT_STATE.md\`.
> \`PROJECT_STATE.md\` on the task branch represents the proposed canonical state change.
> This projection must not be edited or promoted as a competing source of truth.
> Human merge of the task branch into \`main\` promotes the underlying \`PROJECT_STATE.md\` modifications into Human-Trusted State.`;

export function deriveCandidateContent(canonicalMarkdown) {
  const body = canonicalMarkdown.replace(/^#\s+TENNE Project State\s*\r?\n+/, '');
  return `${CANDIDATE_REVIEW_ENVELOPE}\n\n${body.trimEnd()}\n`;
}

export function generateCandidateState(options = {}) {
  const isStdout = options.stdout ?? process.argv.includes('--stdout');
  if (!fs.existsSync(CANONICAL_FILE)) {
    throw new Error(`Canonical project state file not found: ${CANONICAL_FILE}`);
  }

  const canonicalContent = fs.readFileSync(CANONICAL_FILE, 'utf-8');
  const candidateContent = deriveCandidateContent(canonicalContent);

  if (isStdout) {
    process.stdout.write(candidateContent);
    return candidateContent;
  }

  fs.writeFileSync(OUTPUT_FILE, candidateContent, 'utf-8');
  console.log(`[generate-candidate] Successfully generated ${OUTPUT_FILE}`);
  return candidateContent;
}

const isDirectExecution = process.argv[1] && (
  path.resolve(process.argv[1]).toLowerCase() === fileURLToPath(import.meta.url).toLowerCase()
);

if (isDirectExecution) {
  generateCandidateState();
}
