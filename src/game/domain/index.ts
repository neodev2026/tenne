/**
 * TENNE Combat Domain Layer (Headless & Engine-Independent)
 *
 * Rule AS-001: Gameplay and Rendering Separation
 * Rule AS-003: Rendering Cannot Define Gameplay Truth
 * Rule AS-004: Gameplay Logic Must Be Testable Without Browser
 *
 * NOTE: T-000 Bootstrap implements zero gameplay logic.
 */

export interface DomainMetadata {
  layer: 'domain';
  deterministic: true;
  gameplayImplemented: false;
}

export function getDomainState(): DomainMetadata {
  return {
    layer: 'domain',
    deterministic: true,
    gameplayImplemented: false,
  };
}
