import { describe, it, expect } from 'vitest';
import { configNoun } from '../config-noun';

describe('configNoun', () => {
  it('names each modality', () => {
    expect(configNoun('audit')).toBe('Audit');
    expect(configNoun('watcher')).toBe('Watch');
    expect(configNoun('phantom_demand')).toBe('Demand Request');
    // v1.62 — the fourth observation class.
    expect(configNoun('grounded_forecast')).toBe('Grounded Forecast');
  });

  it('names a sourcing-map run (R-10 census H3)', () => {
    expect(configNoun('sourcing_map')).toBe('Sourcing Map run');
  });
});
