import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getProjectStatus } from '../src/main.ts';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ROOT = path.resolve(__dirname, '..');

describe('Agent Harness Infrastructure (M-000, T-000)', () => {
  it('portal status returns expected bootstrap milestone and autonomy level', () => {
    const status = getProjectStatus();
    expect(status.milestone).toBe('M-000');
    expect(status.task).toBe('T-000');
    expect(status.autonomyLevel).toBe('L1.5');
  });

  it('guardrails registry contains exactly 18 approved rules', () => {
    const registryPath = path.join(ROOT, 'guardrails', 'registry.json');
    expect(fs.existsSync(registryPath)).toBe(true);

    const registry = JSON.parse(fs.readFileSync(registryPath, 'utf-8'));
    expect(Array.isArray(registry.guardrails)).toBe(true);
    expect(registry.guardrails.length).toBe(18);

    const allApproved = registry.guardrails.every((g: { status: string }) => g.status === 'approved');
    expect(allApproved).toBe(true);
  });

  it('append-only events.jsonl contains valid historical events', () => {
    const eventsPath = path.join(ROOT, '.agent-history', 'events.jsonl');
    expect(fs.existsSync(eventsPath)).toBe(true);

    const lines = fs.readFileSync(eventsPath, 'utf-8').trim().split('\n');
    expect(lines.length).toBeGreaterThanOrEqual(4);

    for (const line of lines) {
      const parsed = JSON.parse(line);
      expect(parsed).toHaveProperty('eventId');
      expect(parsed).toHaveProperty('timestamp');
      expect(parsed).toHaveProperty('eventType');
      expect(parsed).toHaveProperty('systemFacts');
      expect(parsed).toHaveProperty('agentExplanations');
    }
  });

  it('semantic index contains approved product, architecture, and engineering rules', () => {
    const indexPath = path.join(ROOT, 'semantic', 'index.json');
    expect(fs.existsSync(indexPath)).toBe(true);

    const index = JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
    expect(Array.isArray(index.rules)).toBe(true);
    expect(index.rules.length).toBeGreaterThan(0);

    const as001 = index.rules.find((r: { id: string }) => r.id === 'AS-001');
    expect(as001).toBeDefined();
    expect(as001.status).toBe('approved');

    const ec001 = index.rules.find((r: { id: string }) => r.id === 'EC-001');
    expect(ec001).toBeDefined();
    expect(ec001.status).toBe('approved');
  });

  describe('Task Branch Context Resolution (G-061)', () => {
    it('1. resolves local agent branch as valid task branch when CI context is absent', async () => {
      // @ts-expect-error dynamic import of mjs script in vitest context
      const { resolveBranchContext, isValidTaskBranch, isVerificationAuthorized } = await import('../guardrails/scripts/check-guardrails.mjs');
      const env = {};
      const ctx = resolveBranchContext(env, () => 'agent/t-000-harness-bootstrap');
      expect(ctx.branch).toBe('agent/t-000-harness-bootstrap');
      expect(ctx.isTrustedMainVerification).toBe(false);
      expect(isValidTaskBranch(ctx.branch)).toBe(true);
      expect(isVerificationAuthorized(ctx)).toBe(true);
    });

    it('2. resolves GitHub push on agent/* as valid task branch', async () => {
      // @ts-expect-error dynamic import of mjs script in vitest context
      const { resolveBranchContext, isValidTaskBranch, isVerificationAuthorized } = await import('../guardrails/scripts/check-guardrails.mjs');
      const env = {
        GITHUB_ACTIONS: 'true',
        GITHUB_EVENT_NAME: 'push',
        GITHUB_REF_NAME: 'agent/t-000-harness-bootstrap',
      };
      const ctx = resolveBranchContext(env, () => 'HEAD');
      expect(ctx.branch).toBe('agent/t-000-harness-bootstrap');
      expect(ctx.isTrustedMainVerification).toBe(false);
      expect(isValidTaskBranch(ctx.branch)).toBe(true);
      expect(isVerificationAuthorized(ctx)).toBe(true);
    });

    it('3. resolves GitHub pull_request detached HEAD with GITHUB_HEAD_REF as valid task branch', async () => {
      // @ts-expect-error dynamic import of mjs script in vitest context
      const { resolveBranchContext, isValidTaskBranch, isVerificationAuthorized } = await import('../guardrails/scripts/check-guardrails.mjs');
      const env = {
        GITHUB_ACTIONS: 'true',
        GITHUB_EVENT_NAME: 'pull_request',
        GITHUB_HEAD_REF: 'agent/t-000-harness-bootstrap',
        GITHUB_REF_NAME: '1/merge',
      };
      const ctx = resolveBranchContext(env, () => 'HEAD');
      expect(ctx.branch).toBe('agent/t-000-harness-bootstrap');
      expect(ctx.isTrustedMainVerification).toBe(false);
      expect(isValidTaskBranch(ctx.branch)).toBe(true);
      expect(isVerificationAuthorized(ctx)).toBe(true);
    });

    it('4. rejects arbitrary non-agent branch as invalid task branch', async () => {
      // @ts-expect-error dynamic import of mjs script in vitest context
      const { resolveBranchContext, isValidTaskBranch, isVerificationAuthorized } = await import('../guardrails/scripts/check-guardrails.mjs');
      const env = {
        GITHUB_ACTIONS: 'true',
        GITHUB_EVENT_NAME: 'pull_request',
        GITHUB_HEAD_REF: 'feature/unapproved-task',
      };
      const ctx = resolveBranchContext(env, () => 'HEAD');
      expect(ctx.branch).toBe('feature/unapproved-task');
      expect(isValidTaskBranch(ctx.branch)).toBe(false);
      expect(isVerificationAuthorized(ctx)).toBe(false);
    });

    it('5. rejects local main used as a task branch as invalid', async () => {
      // @ts-expect-error dynamic import of mjs script in vitest context
      const { resolveBranchContext, isValidTaskBranch, isVerificationAuthorized } = await import('../guardrails/scripts/check-guardrails.mjs');
      const env = {};
      const ctx = resolveBranchContext(env, () => 'main');
      expect(ctx.branch).toBe('main');
      expect(ctx.isTrustedMainVerification).toBe(false);
      expect(isValidTaskBranch(ctx.branch)).toBe(false);
      expect(isVerificationAuthorized(ctx)).toBe(false);
    });

    it('6. ignores stray GITHUB_HEAD_REF without actual pull_request GitHub Actions context', async () => {
      // @ts-expect-error dynamic import of mjs script in vitest context
      const { resolveBranchContext, isValidTaskBranch, isVerificationAuthorized } = await import('../guardrails/scripts/check-guardrails.mjs');

      // Case A: Local environment where developer has stray GITHUB_HEAD_REF but GITHUB_ACTIONS is unset
      const envLocalStray = {
        GITHUB_HEAD_REF: 'agent/fake-ci-branch',
      };
      const ctxLocalStray = resolveBranchContext(envLocalStray, () => 'main');
      expect(ctxLocalStray.branch).toBe('main');
      expect(ctxLocalStray.context).toBe('local_git');
      expect(isValidTaskBranch(ctxLocalStray.branch)).toBe(false);
      expect(isVerificationAuthorized(ctxLocalStray)).toBe(false);

      // Case B: CI environment but event is push (not pull_request), stray GITHUB_HEAD_REF must not override GITHUB_REF_NAME
      const envCiPushStray = {
        GITHUB_ACTIONS: 'true',
        GITHUB_EVENT_NAME: 'push',
        GITHUB_REF_NAME: 'feature/random',
        GITHUB_HEAD_REF: 'agent/fake-pr-branch',
      };
      const ctxCiPushStray = resolveBranchContext(envCiPushStray, () => 'HEAD');
      expect(ctxCiPushStray.branch).toBe('feature/random');
      expect(isValidTaskBranch(ctxCiPushStray.branch)).toBe(false);
      expect(isVerificationAuthorized(ctxCiPushStray)).toBe(false);
    });

    it('7. allows main GitHub verification context only through explicit trusted-main path, not isValidTaskBranch', async () => {
      // @ts-expect-error dynamic import of mjs script in vitest context
      const { resolveBranchContext, isValidTaskBranch, isVerificationAuthorized } = await import('../guardrails/scripts/check-guardrails.mjs');
      const envMainPush = {
        GITHUB_ACTIONS: 'true',
        GITHUB_EVENT_NAME: 'push',
        GITHUB_REF_NAME: 'main',
      };
      const ctx = resolveBranchContext(envMainPush, () => 'HEAD');
      expect(ctx.branch).toBe('main');
      expect(ctx.isTrustedMainVerification).toBe(true);

      // Crucial policy check: main is NOT a valid task branch
      expect(isValidTaskBranch(ctx.branch)).toBe(false);

      // Allowed strictly through explicit trusted-main verification authorization path
      expect(isVerificationAuthorized(ctx)).toBe(true);
    });
  });

  describe('Task Identity Resolution (G-060)', () => {
    it('1. resolves active task record when record.branch exactly equals active branch', async () => {
      // @ts-expect-error dynamic import of mjs script in vitest context
      const { resolveTaskRecordForBranch } = await import('../guardrails/scripts/check-guardrails.mjs');
      const res = resolveTaskRecordForBranch('agent/t-001-task-identity-generalization');
      expect(res.valid).toBe(true);
      expect(res.record.id).toBe('T-001');
      expect(res.record.branch).toBe('agent/t-001-task-identity-generalization');
    });

    it('2. blocks when no registered task record matches active branch', async () => {
      // @ts-expect-error dynamic import of mjs script in vitest context
      const { resolveTaskRecordForBranch } = await import('../guardrails/scripts/check-guardrails.mjs');
      const res = resolveTaskRecordForBranch('agent/unregistered-branch-xyz');
      expect(res.valid).toBe(false);
      expect(res.error).toContain('No registered task record found matching active branch');
    });

    it('3. blocks when task record exists but branch differs from active branch', async () => {
      // @ts-expect-error dynamic import of mjs script in vitest context
      const { resolveTaskRecordForBranch } = await import('../guardrails/scripts/check-guardrails.mjs');
      // T-000 has branch 'agent/t-000-harness-bootstrap', so querying with 'agent/t-000-other' must fail
      const res = resolveTaskRecordForBranch('agent/t-000-other');
      expect(res.valid).toBe(false);
      expect(res.error).toContain('No registered task record found matching active branch');
    });

    it('4. blocks when task record is malformed or missing required schema fields', async () => {
      // @ts-expect-error dynamic import of mjs script in vitest context
      const { resolveTaskRecordForBranch } = await import('../guardrails/scripts/check-guardrails.mjs');
      const tempDir = path.join(ROOT, 'scratch', 'test-tasks-malformed');
      fs.mkdirSync(tempDir, { recursive: true });
      try {
        fs.writeFileSync(
          path.join(tempDir, 'INVALID.json'),
          JSON.stringify({ id: 'T-999', branch: 'agent/test-missing-fields' }),
          'utf-8'
        );
        const res = resolveTaskRecordForBranch('agent/test-missing-fields', tempDir);
        expect(res.valid).toBe(false);
        expect(res.error).toContain('missing required schema field');
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it('5. guardrails check succeeds for active task branch with matching record and passes G-060', async () => {
      // @ts-expect-error dynamic import of mjs script in vitest context
      const { checkGuardrails } = await import('../guardrails/scripts/check-guardrails.mjs');
      const result = checkGuardrails({
        branch: 'agent/t-001-task-identity-generalization',
        exitOnError: false,
        fileCount: 5,
      });
      expect(result.success).toBe(true);
      expect(result.hasBlockFailure).toBe(false);
    });

    it('6. guardrails check blocks for active task branch missing registered record', async () => {
      // @ts-expect-error dynamic import of mjs script in vitest context
      const { checkGuardrails } = await import('../guardrails/scripts/check-guardrails.mjs');
      const result = checkGuardrails({
        branch: 'agent/missing-task-record',
        exitOnError: false,
        fileCount: 1,
      });
      expect(result.success).toBe(false);
      expect(result.hasBlockFailure).toBe(true);
    });

    it('7. trusted-main CI verification context does not require active task record', async () => {
      // @ts-expect-error dynamic import of mjs script in vitest context
      const { checkGuardrails } = await import('../guardrails/scripts/check-guardrails.mjs');
      const result = checkGuardrails({
        branch: 'main',
        isTrustedMainVerification: true,
        exitOnError: false,
        fileCount: 0,
      });
      expect(result.success).toBe(true);
      expect(result.hasBlockFailure).toBe(false);
    });

    it('8. confirms G-060 implementation contains zero hardcoded T-000 references', () => {
      const scriptPath = path.join(ROOT, 'guardrails', 'scripts', 'check-guardrails.mjs');
      const content = fs.readFileSync(scriptPath, 'utf-8');
      expect(content).not.toContain('T-000.json');
    });
  });

  describe('Changed-File Budget Accounting (G-031)', () => {
    const FIVE_TASK_FILES = [
      ' M guardrails/scripts/check-guardrails.mjs',
      ' M tests/harness.test.ts',
      '?? .agent-history/tasks/T-001.json',
      '?? .agent-history/approvals/T-001.json',
      ' M .agent-history/events.jsonl',
    ].join('\n');

    const VERIFICATION_LOG_ENTRY = ' M .agent-history/verifications/latest-verification.log';

    it('1. five normal task-scope files are allowed (count = 5)', async () => {
      // @ts-expect-error dynamic import of mjs script in vitest context
      const { getChangedFilesCount, checkGuardrails } = await import('../guardrails/scripts/check-guardrails.mjs');
      expect(getChangedFilesCount(FIVE_TASK_FILES)).toBe(5);

      const result = checkGuardrails({
        branch: 'agent/t-001-task-identity-generalization',
        customPorcelain: FIVE_TASK_FILES,
        exitOnError: false,
      });
      expect(result.success).toBe(true);
      expect(result.hasHumanReviewPending).toBe(false);
    });

    it('2. five normal task-scope files + exact latest-verification.log is still counted as 5 for G-031', async () => {
      // @ts-expect-error dynamic import of mjs script in vitest context
      const { getChangedFilesCount, checkGuardrails } = await import('../guardrails/scripts/check-guardrails.mjs');
      const porcelainWithLog = `${FIVE_TASK_FILES}\n${VERIFICATION_LOG_ENTRY}`;
      expect(getChangedFilesCount(porcelainWithLog)).toBe(5);

      const result = checkGuardrails({
        branch: 'agent/t-001-task-identity-generalization',
        customPorcelain: porcelainWithLog,
        exitOnError: false,
      });
      expect(result.success).toBe(true);
      expect(result.hasHumanReviewPending).toBe(false);
    });

    it('3. six normal task-scope files fail G-031 without override (count = 6)', async () => {
      // @ts-expect-error dynamic import of mjs script in vitest context
      const { getChangedFilesCount, checkGuardrails } = await import('../guardrails/scripts/check-guardrails.mjs');
      const sixFiles = `${FIVE_TASK_FILES}\n M src/unauthorized.ts`;
      expect(getChangedFilesCount(sixFiles)).toBe(6);

      const result = checkGuardrails({
        branch: 'agent/t-001-task-identity-generalization',
        customPorcelain: sixFiles,
        exitOnError: false,
      });
      expect(result.success).toBe(false);
      expect(result.hasHumanReviewPending).toBe(true);
    });

    it('4. another arbitrary file under .agent-history/verifications/ is NOT excluded', async () => {
      // @ts-expect-error dynamic import of mjs script in vitest context
      const { getChangedFilesCount, checkGuardrails } = await import('../guardrails/scripts/check-guardrails.mjs');
      const arbitraryLog = `${FIVE_TASK_FILES}\n M .agent-history/verifications/arbitrary-run.log`;
      expect(getChangedFilesCount(arbitraryLog)).toBe(6);

      const result = checkGuardrails({
        branch: 'agent/t-001-task-identity-generalization',
        customPorcelain: arbitraryLog,
        exitOnError: false,
      });
      expect(result.success).toBe(false);
      expect(result.hasHumanReviewPending).toBe(true);
    });

    it('5. exclusion cannot be used for another path with a similar filename', async () => {
      // @ts-expect-error dynamic import of mjs script in vitest context
      const { getChangedFilesCount } = await import('../guardrails/scripts/check-guardrails.mjs');
      const similarA = `${FIVE_TASK_FILES}\n M .agent-history/verifications/latest-verification.log.bak`;
      expect(getChangedFilesCount(similarA)).toBe(6);

      const similarB = `${FIVE_TASK_FILES}\n M scratch/latest-verification.log`;
      expect(getChangedFilesCount(similarB)).toBe(6);

      const similarC = `${FIVE_TASK_FILES}\n M docs/latest-verification.log`;
      expect(getChangedFilesCount(similarC)).toBe(6);
    });
  });
});
