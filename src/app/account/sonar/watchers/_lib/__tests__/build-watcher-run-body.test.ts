import { describe, it, expect } from 'vitest';
import type { WatcherScope } from '@haiwave/protocol';
import { buildWatcherRunBody } from '../build-watcher-run-body';

describe('buildWatcherRunBody — sku_asks', () => {
  it('includes sku_asks when present', () => {
    const scope = {
      kind: 'watcher',
      authorization_basis: 'bilateral',
      counterparties: [],
      signal_types: ['soft_quoted_lead_time'],
      skus: ['PN-88A'],
      depth_limit: 1,
      sku_asks: [{ sku: 'PN-88A', ask_quantity: 40, target_days: 30 }],
    } as WatcherScope;
    expect(buildWatcherRunBody(scope, 't1').sku_asks).toEqual([
      { sku: 'PN-88A', ask_quantity: 40, target_days: 30 },
    ]);
  });

  it('omits sku_asks when absent', () => {
    const scope = {
      kind: 'watcher',
      authorization_basis: 'bilateral',
      counterparties: [],
      signal_types: ['published_lead_time'],
      skus: ['PN-88A'],
      depth_limit: 1,
    } as WatcherScope;
    expect('sku_asks' in buildWatcherRunBody(scope, 't1')).toBe(false);
  });
});
