import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MOCK_ADMIN_STATS } from '@/lib/mock-data';

/**
 * Broker P3 T6 (P7c, ruled): the admin dashboard renders from the REAL
 * haiCore AdminOverview payload. The pre-P3 page expected a fictional
 * `agent_health{active,jailed,probation,offline}` shape haiCore never
 * returned — the real payload threw and the page silently fell back to mock
 * forever. The distribution re-keys to the DERIVED availability
 * (Healthy / Quiet / Unreachable / Suspended), and the dev fallback mock is
 * reshaped to the real payload so it can never mask the contract again.
 */

// A REAL haiCore /admin/dashboard/overview payload (protocol AdminOverview,
// with the P3 additive availability block).
const REAL_OVERVIEW = {
  participants: { total: 12, active: 10, suspended: 1, pending: 1 },
  trading_pairs: { total: 24, active_30d: 7 },
  agents: {
    total: 11,
    active: 9,
    jailed: 1,
    probation: 0,
    revoked: 1,
    availability: { healthy: 6, quiet: 2, unreachable: 1, not_deployed: 2 },
  },
  gofish: { queries_24h: 3, queries_7d: 21 },
  orders: { total: 40, open: 5 },
};

vi.mock('@/lib/use-api', () => ({
  useApi: () => ({ data: REAL_OVERVIEW, loading: false, error: null }),
}));

import { AdminDashboard } from '../admin-dashboard';

describe('AdminDashboard on the real payload (P7c)', () => {
  it('renders the availability distribution: Healthy / Quiet / Unreachable / Suspended', () => {
    render(<AdminDashboard />);
    expect(screen.getByText(/Healthy: 6/)).toBeInTheDocument();
    expect(screen.getByText(/Quiet: 2/)).toBeInTheDocument();
    expect(screen.getByText(/Unreachable: 1/)).toBeInTheDocument();
    // Suspended = the administrative jailed count (P3: status is a decision).
    expect(screen.getByText(/Suspended: 1/)).toBeInTheDocument();
  });

  it('retires the dead taxonomy — no Probation, no Offline, no bare Jailed label', () => {
    render(<AdminDashboard />);
    expect(screen.queryByText(/Probation/)).toBeNull();
    expect(screen.queryByText(/Offline/)).toBeNull();
    expect(screen.queryByText(/Jailed/)).toBeNull();
  });

  it('binds the stat cards to the real nested fields', () => {
    render(<AdminDashboard />);
    expect(screen.getByText('12')).toBeInTheDocument(); // participants.total
    expect(screen.getByText('24')).toBeInTheDocument(); // trading_pairs.total
    // Agent Health tile: healthy over the DEPLOYED derivation population —
    // not_deployed agents are in setup, not in fault, and stay out of the
    // denominator (2 of them here would make it 11).
    expect(screen.getByText(/6\/9 healthy/)).toBeInTheDocument();
  });
});

describe('MOCK_ADMIN_STATS matches the real payload shape', () => {
  it('carries the protocol AdminOverview fields, not the fictional agent_health', () => {
    expect(MOCK_ADMIN_STATS.trading_pairs).toHaveProperty('total');
    expect(MOCK_ADMIN_STATS.agents).toHaveProperty('availability');
    expect(MOCK_ADMIN_STATS).not.toHaveProperty('agent_health');
    expect(MOCK_ADMIN_STATS).not.toHaveProperty('outstanding_amount');
  });
});
