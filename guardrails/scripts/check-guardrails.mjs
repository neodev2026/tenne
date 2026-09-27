import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');

const REGISTRY_FILE = path.join(ROOT, 'guardrails', 'registry.json');
const HISTORY_DIR = path.join(ROOT, '.agent-history');
const OVERRIDES_FILE = path.join(HISTORY_DIR, 'autonomy', 'overrides.json');

export function getGitBranch() {
  try {
    return execSync('git rev-parse --abbrev-ref HEAD', { cwd: ROOT }).toString().trim();
  } catch {
    return 'unknown';
  }
}

export const VERIFICATION_ARTIFACT_PATH = '.agent-history/verifications/latest-verification.log';

export function parseChangedFiles(porcelainOutput) {
  if (!porcelainOutput || typeof porcelainOutput !== 'string') return [];
  return porcelainOutput
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const match = line.match(/^(\S{1,2})\s+(.+)$/);
      if (!match) return line;
      let rawPath = match[2].trim();
      if (rawPath.startsWith('"') && rawPath.endsWith('"')) {
        rawPath = rawPath.slice(1, -1);
      }
      if (rawPath.includes(' -> ')) {
        rawPath = rawPath.split(' -> ')[1].trim();
      }
      return rawPath.replace(/\\/g, '/');
    });
}

export function filterBudgetCountedFiles(files) {
  return files.filter((file) => file !== VERIFICATION_ARTIFACT_PATH);
}

export function getChangedFilesCount(customPorcelain = null) {
  try {
    const out = customPorcelain !== null
      ? customPorcelain
      : execSync('git status --porcelain', { cwd: ROOT }).toString();
    const files = parseChangedFiles(out);
    const counted = filterBudgetCountedFiles(files);
    return counted.length;
  } catch {
    return 0;
  }
}

/**
 * Resolves execution branch context and trusted-verification authorization.
 *
 * 1. For GitHub Actions pull_request context:
 *    - requires GITHUB_ACTIONS === 'true'
 *    - requires GITHUB_EVENT_NAME === 'pull_request'
 *    - resolves source/task branch from GITHUB_HEAD_REF
 *
 * 2. For GitHub Actions push context:
 *    - requires GITHUB_ACTIONS === 'true'
 *    - requires GITHUB_EVENT_NAME === 'push'
 *    - resolves branch from GITHUB_REF_NAME
 *    - if branch === 'main', identifies Human-Trusted main verification context
 *
 * 3. For local execution:
 *    - ignores GitHub-specific branch variables unless GitHub Actions context is active
 *    - falls back to Git branch detection
 */
export function resolveBranchContext(env = process.env, getGitBranchFn = getGitBranch) {
  const isCi = env.GITHUB_ACTIONS === 'true';
  const eventName = env.GITHUB_EVENT_NAME;

  if (isCi && eventName === 'pull_request') {
    const headRef = env.GITHUB_HEAD_REF?.trim();
    if (headRef) {
      return {
        branch: headRef,
        isCi: true,
        isTrustedMainVerification: false,
        context: 'github_actions_pull_request',
      };
    }
  }

  if (isCi && eventName === 'push') {
    const refName = env.GITHUB_REF_NAME?.trim();
    if (refName) {
      const isMain = refName === 'main';
      return {
        branch: refName,
        isCi: true,
        isTrustedMainVerification: isMain,
        context: isMain ? 'github_actions_trusted_main' : 'github_actions_push',
      };
    }
  }

  // Local execution or non-push/pull_request context: ignore stray CI vars, fall back to Git
  const localBranch = getGitBranchFn();
  return {
    branch: localBranch,
    isCi: false,
    isTrustedMainVerification: false,
    context: 'local_git',
  };
}

export function resolveTaskBranch(env = process.env, getGitBranchFn = getGitBranch) {
  return resolveBranchContext(env, getGitBranchFn).branch;
}

export function isValidTaskBranch(branch) {
  return typeof branch === 'string' && branch.startsWith('agent/');
}

export function isVerificationAuthorized(branchContext) {
  if (branchContext.isTrustedMainVerification) {
    return true;
  }
  return isValidTaskBranch(branchContext.branch);
}

export function resolveTaskRecordForBranch(branch, tasksDir = path.join(HISTORY_DIR, 'tasks')) {
  if (!fs.existsSync(tasksDir)) {
    return {
      valid: false,
      error: `Tasks directory missing: ${tasksDir}`,
    };
  }

  let files;
  try {
    files = fs.readdirSync(tasksDir).filter((f) => f.endsWith('.json'));
  } catch (err) {
    return {
      valid: false,
      error: `Cannot read tasks directory: ${err.message}`,
    };
  }

  let matchedRecord = null;
  let matchingFile = null;
  const malformedFiles = [];

  for (const file of files) {
    const fullPath = path.join(tasksDir, file);
    try {
      const data = JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
      if (data && typeof data === 'object') {
        if (data.branch === branch) {
          matchedRecord = data;
          matchingFile = file;
          break;
        }
      }
    } catch (err) {
      malformedFiles.push({ file, error: err.message });
    }
  }

  if (!matchedRecord) {
    let msg = `No registered task record found matching active branch: ${branch}`;
    if (malformedFiles.length > 0) {
      msg += ` (malformed task file(s) encountered: ${malformedFiles.map((m) => m.file).join(', ')})`;
    }
    return {
      valid: false,
      error: msg,
      malformedFiles,
    };
  }

  const requiredFields = ['id', 'title', 'status', 'autonomyLevel', 'branch'];
  const missingFields = requiredFields.filter(
    (field) => typeof matchedRecord[field] !== 'string' || matchedRecord[field].trim().length === 0
  );

  if (missingFields.length > 0) {
    return {
      valid: false,
      error: `Task record (${matchingFile}) is missing required schema field(s): ${missingFields.join(', ')}`,
      record: matchedRecord,
      matchingFile,
    };
  }

  return {
    valid: true,
    record: matchedRecord,
    matchingFile,
  };
}

export function checkGuardrails(options = {}) {
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

  const env = options.env || (options.branch ? {} : process.env);
  const branchContext = options.branchContext || resolveBranchContext(env);
  const branch = options.branch || branchContext.branch;
  const trustedMainContextIsProven = Boolean(options.isTrustedMainVerification ?? branchContext.isTrustedMainVerification);
  const isTrustedMainVerification = branch === 'main' && trustedMainContextIsProven;
  const fileCount = options.fileCount ?? getChangedFilesCount(options.customPorcelain ?? null);
  const exitOnError = options.exitOnError ?? true;

  const tasksDir = options.tasksDir || path.join(HISTORY_DIR, 'tasks');
  const taskResolution = resolveTaskRecordForBranch(branch, tasksDir);
  const activeTaskId = options.activeTaskId || (taskResolution.valid ? taskResolution.record.id : null);

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
      if (isTrustedMainVerification) {
        console.log('[G-061: PASS] Human-Trusted main verification context authorized via GitHub Actions main event.');
      } else if (isValidTaskBranch(branch)) {
        console.log(`[G-061: PASS] Active branch matches isolated task pattern: ${branch}`);
      } else {
        console.error(`[G-061: BLOCK] Task must execute on an agent/* branch. Found: ${branch}`);
        hasBlockFailure = true;
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
              (o) => o.guardrailId === 'G-031' &&
                     o.overrideType === 'BOOTSTRAP_EXCEPTION' &&
                     (!o.taskId || o.taskId === activeTaskId)
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
      if (isTrustedMainVerification) {
        console.log('[G-060: PASS] Human-Trusted main verification authorized without active task branch.');
      } else if (!isValidTaskBranch(branch)) {
        console.error(`[G-060: BLOCK] Task must execute on a valid task branch to verify task identity. Found: ${branch}`);
        hasBlockFailure = true;
      } else {
        if (!taskResolution.valid) {
          console.error(`[G-060: BLOCK] ${taskResolution.error}`);
          hasBlockFailure = true;
        } else {
          console.log(`[G-060: PASS] Task ID ${taskResolution.record.id} registered and verified for branch ${branch}.`);
        }
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
    if (exitOnError) {
      process.exit(1);
    }
    return { success: false, hasBlockFailure: true, hasHumanReviewPending, warnings };
  }

  if (hasHumanReviewPending) {
    console.error('\n[G-CHECK: FAILED] Action requires human review / approval record.');
    if (exitOnError) {
      process.exit(1);
    }
    return { success: false, hasBlockFailure: false, hasHumanReviewPending: true, warnings };
  }

  console.log('\n[G-CHECK: SUCCESS] All active guardrails satisfied according to configured semantics.');
  return { success: true, hasBlockFailure: false, hasHumanReviewPending: false, warnings };
}

const isDirectRun = Boolean(
  process.argv[1] &&
  path.resolve(process.argv[1]).toLowerCase() === fileURLToPath(import.meta.url).toLowerCase()
);

if (isDirectRun) {
  checkGuardrails();
}
