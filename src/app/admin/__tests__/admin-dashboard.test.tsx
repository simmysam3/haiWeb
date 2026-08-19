import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';

/**
 * Broker P3 T6 (P7c, ruled): the admin dashboard renders from the REAL
 * haiCore AdminOverview payload; the distribution keys to the DERIVED
 * availability (Healthy / Quiet / Unreachable / Suspended).
 *
 * v1.75 walk W3: Recent Registrations and Suspended Accounts were still mock
 * theater on an otherwise-real dashboard, and a stats API failure silently
 * fell back to MOCK_ADMIN_STATS (F-4 residue). These tests pin the rebind:
 * both cards render the real participants list, and any API failure surfaces
 * as absence + an error notice — never as mock numbers or mock rows.
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

// A REAL GET /api/admin/participants payload (haiCore listParticipants),
// newest-first as the server orders it.
const REAL_LIST = {
  participants: [
    {
      participant_id: '33333333-3333-4333-8333-333333333333',
      legal_name: 'Newest Fasteners Inc',
      status: 'active',
      business_address_city: 'Reno',
      business_address_state: 'NV',
      business_address_country: 'US',
      registered_at: '2026-08-15T00:00:00.000Z',
      suspension_reason: null,
      agent_count: 1,
      trading_pair_count: 0,
    },
    {
      participant_id: '44444444-4444-4444-8444-444444444444',
      legal_name: 'Great Lakes Brass',
      status: 'suspended',
      business_address_city: null,
      business_address_state: null,
      business_address_country: null,
      registered_at: '2026-06-15T00:00:00.000Z',
      suspension_reason: 'payment fraud investigation',
      agent_count: 1,
      trading_pair_count: 1,
    },
  ],
  total_count: 2,
};

const { routes } = vi.hoisted(() => ({
  routes: new Map<string, unknown>(),
}));

vi.mock('@/lib/use-api', () => ({
  useApi: (opts: { url: string }) =>
    routes.get(opts.url) ?? { data: null, loading: false, error: null, refetch: () => {} },
}));

import { AdminDashboard } from '../admin-dashboard';

function happyRoutes() {
  routes.clear();
  routes.set('/api/admin/dashboard?type=overview', {
    data: REAL_OVERVIEW, loading: false, error: null, refetch: () => {},
  });
  routes.set('/api/admin/participants', {
    data: REAL_LIST, loading: false, error: null, refetch: () => {},
  });
}

describe('AdminDashboard on the real payload (P7c)', () => {
  beforeEach(happyRoutes);

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

describe('AdminDashboard lists on the real participants API (v1.75 walk W3)', () => {
  beforeEach(happyRoutes);

  it('Recent Registrations renders the real list, newest first, not mock rows', () => {
    render(<AdminDashboard />);
    const card = screen.getByText('Recent Registrations').closest('div')!.parentElement!;
    expect(within(card).getByText('Newest Fasteners Inc')).toBeInTheDocument();
    expect(within(card).getByText('Reno, NV')).toBeInTheDocument();
  });

  it('Suspended Accounts renders the real suspended rows with their reasons and a manage link', () => {
    render(<AdminDashboard />);
    expect(screen.getByText('payment fraud investigation')).toBeInTheDocument();
    const manage = screen.getByRole('link', { name: /manage/i });
    expect(manage).toHaveAttribute('href', '/admin/participants');
  });

  it('a stats API failure surfaces as absence + an error notice, never mock numbers', () => {
    routes.set('/api/admin/dashboard?type=overview', {
      data: null, loading: false, error: '503', refetch: () => {},
    });
    render(<AdminDashboard />);
    expect(screen.getByText(/couldn't load network stats/i)).toBeInTheDocument();
    // The old silent-mock numbers must not appear from anywhere.
    expect(screen.queryByText('12')).toBeNull();
    expect(screen.queryByText(/healthy/i)).toBeNull();
  });

  it('a list API failure keeps the cards honest — notice, no rows', () => {
    routes.set('/api/admin/participants', {
      data: null, loading: false, error: '502', refetch: () => {},
    });
    render(<AdminDashboard />);
    expect(screen.getByText(/couldn't load participants/i)).toBeInTheDocument();
    expect(screen.queryByText('Newest Fasteners Inc')).toBeNull();
  });
});
