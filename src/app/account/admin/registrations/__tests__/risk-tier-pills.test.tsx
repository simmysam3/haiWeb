import '@testing-library/jest-dom/vitest';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RiskTierPills } from '../risk-tier-pills';

describe('RiskTierPills', () => {
  it('standard → a single "Standard" pill', () => {
    render(<RiskTierPills tier="standard" />);
    expect(screen.getByText('Standard')).toBeInTheDocument();
    expect(screen.queryByText('Foreign')).not.toBeInTheDocument();
    expect(screen.queryByText('Sanctioned')).not.toBeInTheDocument();
  });

  it('elevated → a single "Foreign" pill (literal, not "Elevated")', () => {
    render(<RiskTierPills tier="elevated" />);
    expect(screen.getByText('Foreign')).toBeInTheDocument();
    expect(screen.queryByText('Elevated')).not.toBeInTheDocument();
    expect(screen.queryByText('Sanctioned')).not.toBeInTheDocument();
  });

  it('blocked → BOTH a "Foreign" and a "Sanctioned" pill (sanctioned is also foreign)', () => {
    render(<RiskTierPills tier="blocked" />);
    expect(screen.getByText('Foreign')).toBeInTheDocument();
    expect(screen.getByText('Sanctioned')).toBeInTheDocument();
    expect(screen.queryByText('Blocked')).not.toBeInTheDocument();
  });
});
