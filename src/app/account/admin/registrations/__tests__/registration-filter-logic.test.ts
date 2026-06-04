import { describe, it, expect } from 'vitest';
import { riskTierMatches } from '../registration-filter-logic';

/**
 * BUG-4: the risk-tier filter is NON-EXCLUSIVE and mirrors the pill display
 * (RiskTierPills), where a `blocked` request shows BOTH a "Foreign" and a
 * "Sanctioned" pill — sanctioned IS foreign. The filter tokens are the display
 * tokens (standard|foreign|sanctioned), not the underlying enum.
 *
 *   Standard   → risk_tier === 'standard'
 *   Foreign    → risk_tier === 'elevated' || risk_tier === 'blocked'  (non-exclusive)
 *   Sanctioned → risk_tier === 'blocked'
 *   All/empty  → everything
 */
describe('riskTierMatches — BUG-4 non-exclusive, display-aligned risk-tier filter', () => {
  it('Foreign matches a blocked (sanctioned) row — sanctioned IS foreign', () => {
    // Load-bearing case: previously impossible with the 1:1 enum mapping.
    expect(riskTierMatches('blocked', 'foreign')).toBe(true);
  });

  it('Foreign matches an elevated row', () => {
    expect(riskTierMatches('elevated', 'foreign')).toBe(true);
  });

  it('Foreign does NOT match a standard row', () => {
    expect(riskTierMatches('standard', 'foreign')).toBe(false);
  });

  it('Sanctioned matches a blocked row', () => {
    expect(riskTierMatches('blocked', 'sanctioned')).toBe(true);
  });

  it('Sanctioned does NOT match an elevated row', () => {
    expect(riskTierMatches('elevated', 'sanctioned')).toBe(false);
  });

  it('Sanctioned does NOT match a standard row', () => {
    expect(riskTierMatches('standard', 'sanctioned')).toBe(false);
  });

  it('Standard matches a standard row', () => {
    expect(riskTierMatches('standard', 'standard')).toBe(true);
  });

  it('Standard does NOT match an elevated row', () => {
    expect(riskTierMatches('elevated', 'standard')).toBe(false);
  });

  it('Standard does NOT match a blocked row', () => {
    expect(riskTierMatches('blocked', 'standard')).toBe(false);
  });

  it('All (empty token) matches every tier', () => {
    expect(riskTierMatches('standard', '')).toBe(true);
    expect(riskTierMatches('elevated', '')).toBe(true);
    expect(riskTierMatches('blocked', '')).toBe(true);
  });

  it('All (undefined token) matches every tier', () => {
    expect(riskTierMatches('standard', undefined)).toBe(true);
    expect(riskTierMatches('elevated', undefined)).toBe(true);
    expect(riskTierMatches('blocked', undefined)).toBe(true);
  });

  it('an unrecognized token matches everything (defensive: behaves like All)', () => {
    expect(riskTierMatches('blocked', 'nonsense')).toBe(true);
  });
});
