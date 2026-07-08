import '@testing-library/jest-dom/vitest';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatCard } from '../stat-card';

/**
 * StatCard treats an absent value as "Not Available" so the dashboard never
 * fabricates a number for a metric that has no real data yet. A trend is
 * meaningless without a value, so it is suppressed in that case.
 */
describe('StatCard', () => {
  it('renders the provided value', () => {
    render(<StatCard label="Participants" value="42" />);
    expect(screen.getByText('42')).toBeInTheDocument();
  });

  it('shows "Not Available" when the value is null', () => {
    render(<StatCard label="Trading Pairs" value={null} />);
    expect(screen.getByText('Not Available')).toBeInTheDocument();
  });

  it('shows "Not Available" when the value is an empty string', () => {
    render(<StatCard label="Agents Online" value="" />);
    expect(screen.getByText('Not Available')).toBeInTheDocument();
  });

  it('suppresses the trend when the value is unavailable', () => {
    render(<StatCard label="Behavioral Score" value={null} trend={8} />);
    expect(screen.queryByText(/vs last period/)).not.toBeInTheDocument();
  });

  it('still renders the trend alongside a real value', () => {
    render(<StatCard label="Behavioral Score" value="91%" trend={2} />);
    expect(screen.getByText('91%')).toBeInTheDocument();
    expect(screen.getByText(/\+2% vs last period/)).toBeInTheDocument();
  });
});
