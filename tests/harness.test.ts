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
});
