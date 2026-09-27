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
});
