import { describe, it, expect, vi } from 'vitest';
import { describeChange } from '../describe-change';
import type { ComplianceChange } from '@haiwave/protocol';

describe('describeChange authored overrides', () => {
  it('upstream_risk_reported gets the authored label, not titlecase, and no dev warn', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const change = {
      change_kind: 'upstream_risk_reported',
      prior_value: null,
      current_value: null,
      component_ref: 'SKU-1',
    } as unknown as ComplianceChange; // legal only from 3.66.0; cast documents the forward-carry
    expect(describeChange(change)).toBe(
      'The vendor reports risk to this order from its own upstream supply chain — its promise is unchanged; treat this as advance warning.',
    );
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});
