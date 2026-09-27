import { describe, it, expect } from 'vitest';
import { getDomainState } from '../src/game/domain/index.ts';
import { getApplicationState } from '../src/game/application/index.ts';

describe('Game Architecture Isolation (AS-001, AS-004)', () => {
  it('domain state should be deterministic and engine-independent', () => {
    const domain = getDomainState();
    expect(domain.layer).toBe('domain');
    expect(domain.deterministic).toBe(true);
    expect(domain.gameplayImplemented).toBe(false);
  });

  it('application state should initialize in bootstrap standby', () => {
    const app = getApplicationState();
    expect(app.layer).toBe('application');
    expect(app.status).toBe('BOOTSTRAP_STANDBY');
  });
});
