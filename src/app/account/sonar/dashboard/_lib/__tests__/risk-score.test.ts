import { describe, it, expect } from 'vitest';
import { computeRiskScore, MISSING_WEIGHT } from '../risk-score';

describe('computeRiskScore', () => {
  it('all-healthy partner: 0/0/0 → green normal', () => {
    expect(computeRiskScore({ audit: 0, phantom_demand: 0, type2: 0 })).toEqual({
      score: 0,
      color: 'green',
      label: 'normal',
    });
  });

  it('all-red partner: 1/1/1 → red critical', () => {
    expect(computeRiskScore({ audit: 1, phantom_demand: 1, type2: 1 })).toEqual({
      score: 1,
      color: 'red',
      label: 'critical',
    });
  });

  it('all-missing partner: weights default to 0.25 → green', () => {
    const result = computeRiskScore({ audit: null, phantom_demand: null, type2: null });
    expect(result.score).toBeCloseTo(0.25, 5);
    expect(result.color).toBe('green');
    expect(result.label).toBe('normal');
  });

  it('at-capacity type 2 only, two missing → yellow elevated', () => {
    // 0.25*0.4 + 0.25*0.3 + 1.0*0.3 = 0.475
    const result = computeRiskScore({ audit: null, phantom_demand: null, type2: 1 });
    expect(result.score).toBeCloseTo(0.475, 5);
    expect(result.color).toBe('yellow');
    expect(result.label).toBe('elevated');
  });

  it('50% non-compliant audit + at-capacity type 2 + missing PD → yellow', () => {
    // 0.5*0.4 + 0.25*0.3 + 1.0*0.3 = 0.575
    const result = computeRiskScore({ audit: 0.5, phantom_demand: null, type2: 1 });
    expect(result.score).toBeCloseTo(0.575, 5);
    expect(result.color).toBe('yellow');
  });

  it('threshold boundary: score === 0.33 → yellow (strict <)', () => {
    // Find audit_w that gives exactly 0.33 with PD=0, t2=0:
    // audit_w * 0.4 = 0.33  →  audit_w = 0.825
    const result = computeRiskScore({ audit: 0.825, phantom_demand: 0, type2: 0 });
    expect(result.score).toBeCloseTo(0.33, 5);
    expect(result.color).toBe('yellow');
  });

  it('just below 0.33 → green', () => {
    const result = computeRiskScore({ audit: 0.8, phantom_demand: 0, type2: 0 });
    // 0.8 * 0.4 = 0.32
    expect(result.score).toBeCloseTo(0.32, 5);
    expect(result.color).toBe('green');
  });

  it('threshold boundary: score === 0.67 → red (strict <)', () => {
    // 1*0.4 + 0.9*0.3 + 0*0.3 = 0.67 — verifies strict < at 0.67
    const result = computeRiskScore({ audit: 1, phantom_demand: 0.9, type2: 0 });
    expect(result.score).toBeCloseTo(0.67, 5);
    expect(result.color).toBe('red');
    expect(result.label).toBe('critical');
  });

  it('exposes MISSING_WEIGHT constant for downstream callers', () => {
    expect(MISSING_WEIGHT).toBe(0.25);
  });

  it('clamps weights into [0,1] if a caller passes out-of-range values', () => {
    const result = computeRiskScore({ audit: 1.5, phantom_demand: -0.2, type2: 0.5 });
    // audit clamped to 1, pd clamped to 0:  1*0.4 + 0*0.3 + 0.5*0.3 = 0.55
    expect(result.score).toBeCloseTo(0.55, 5);
    expect(result.color).toBe('yellow');
  });
});
