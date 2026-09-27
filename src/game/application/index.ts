/**
 * TENNE Application Services Layer
 *
 * Orchestrates use cases and bridges presentation adapters to domain logic.
 */

export interface ApplicationMetadata {
  layer: 'application';
  status: 'BOOTSTRAP_STANDBY';
}

export function getApplicationState(): ApplicationMetadata {
  return {
    layer: 'application',
    status: 'BOOTSTRAP_STANDBY',
  };
}
