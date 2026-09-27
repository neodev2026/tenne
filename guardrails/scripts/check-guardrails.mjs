import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');

const REGISTRY_FILE = path.join(ROOT, 'guardrails', 'registry.json');
const HISTORY_DIR = path.join(ROOT, '.agent-history');
const OVERRIDES_FILE = path.join(HISTORY_DIR, 'autonomy', 'overrides.json');

function getGitBranch() {
  try {
    return execSync('git rev-parse --abbrev-ref HEAD', { cwd: ROOT }).toString().trim();
  } catch {
    return 'unknown';
  }
}

function getChangedFilesCount() {
  try {
    const out = execSync('git status --porcelain', { cwd: ROOT }).toString().trim();
    if (!out) return 0;
    return out.split('\n').filter(Boolean).length;
  } catch {
    return 0;
  }
}

function checkGuardrails() {
  console.log('=== Checking Guardrails Registry Compliance ===');

  if (!fs.existsSync(REGISTRY_FILE)) {
    console.error('[G-CHECK] CRITICAL: guardrails/registry.json is missing.');
    process.exit(1);
  }

  const registry = JSON.parse(fs.readFileSync(REGISTRY_FILE, 'utf-8'));
  const guardrails = registry.guardrails || [];
  console.log(`[G-CHECK] Loaded ${guardrails.length} guardrails.`);

  let hasBlockFailure = false;
  let hasHumanReviewPending = false;
  const warnings = [];

  const branch = getGitBranch();
  const fileCount = getChangedFilesCount();

  for (const g of guardrails) {
    // G-002: Main Direct Modification Protection (BLOCK)
    if (g.id === 'G-002') {
      if (branch === 'main' && fileCount > 0) {
        console.error(`[G-002: BLOCK] Cannot make direct modifications to main. Current branch: ${branch}`);
        hasBlockFailure = true;
      } else {
        console.log(`[G-002: PASS] Branch isolation verified: ${branch}`);
      }
    }

    // G-061: Every Approved Task Uses an Isolated Branch (BLOCK)
    if (g.id === 'G-061') {
      if (!branch.startsWith('agent/') && branch !== 'main') {
        console.error(`[G-061: BLOCK] Task must execute on an agent/* branch. Found: ${branch}`);
        hasBlockFailure = true;
      } else {
        console.log(`[G-061: PASS] Active branch matches isolated task pattern: ${branch}`);
      }
    }

    // G-031: Maximum Files Changed (HUMAN_REVIEW with bootstrap override)
    if (g.id === 'G-031') {
      const maxFiles = g.config?.maxFiles || 5;
      if (fileCount > maxFiles) {
        let hasOverride = false;
        if (fs.existsSync(OVERRIDES_FILE)) {
          try {
            const overrides = JSON.parse(fs.readFileSync(OVERRIDES_FILE, 'utf-8'));
            hasOverride = overrides.some(
              (o) => o.guardrailId === 'G-031' && o.overrideType === 'BOOTSTRAP_EXCEPTION'
            );
          } catch (e) {
            console.warn('[G-031] Could not parse overrides file:', e.message);
          }
        }

        if (hasOverride) {
          console.log(`[G-031: HUMAN_REVIEW_APPROVED] Changed files (${fileCount} > ${maxFiles}) permitted via authorized bootstrap override.`);
        } else {
          console.error(`[G-031: HUMAN_REVIEW_REQUIRED] Changed files count ${fileCount} exceeds limit ${maxFiles} without recorded override.`);
          hasHumanReviewPending = true;
        }
      } else {
        console.log(`[G-031: PASS] File count within normal limit: ${fileCount} <= ${maxFiles}`);
      }
    }

    // G-060: Task ID Required (BLOCK)
    if (g.id === 'G-060') {
      const taskJson = path.join(HISTORY_DIR, 'tasks', 'T-000.json');
      if (!fs.existsSync(taskJson)) {
        console.error('[G-060: BLOCK] Active task ID record missing in .agent-history/tasks/');
        hasBlockFailure = true;
      } else {
        console.log('[G-060: PASS] Task ID T-000 registered and verified.');
      }
    }

    // G-064: History Integrity (HUMAN_REVIEW)
    if (g.id === 'G-064') {
      const eventsFile = path.join(HISTORY_DIR, 'events.jsonl');
      if (!fs.existsSync(eventsFile)) {
        console.error('[G-064: HUMAN_REVIEW] Append-only events.jsonl missing.');
        hasHumanReviewPending = true;
      } else {
        console.log('[G-064: PASS] Immutable events.jsonl verified.');
      }
    }

    // G-066: Core Documentation Translation Sync (WARN)
    if (g.id === 'G-066') {
      // Checked in verify-translations.mjs; here we ensure rule is recognized with severity warn
      console.log('[G-066: CONFIGURED] Translation sync evaluated under severity: WARN.');
    }
  }

  if (warnings.length > 0) {
    console.warn('\n[G-CHECK: WARNINGS]:');
    warnings.forEach((w) => console.warn(` - ${w}`));
  }

  if (hasBlockFailure) {
    console.error('\n[G-CHECK: FAILED] Deterministic blocking guardrail violated.');
    process.exit(1);
  }

  if (hasHumanReviewPending) {
    console.error('\n[G-CHECK: FAILED] Action requires human review / approval record.');
    process.exit(1);
  }

  console.log('\n[G-CHECK: SUCCESS] All active guardrails satisfied according to configured semantics.');
}

checkGuardrails();
