import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { PhantomDemandRunDetail } from '@/lib/haiwave-api';

// Stub SWR so it never fires real fetch calls in tests. The shell receives
// `initialDetail` as a prop; polling is an integration concern covered by e2e.
vi.mock('swr', () => ({
  default: () => ({ data: undefined, error: undefined }),
}));

import { RunDetailShell } from '../run-detail-shell';

const makeTree = () => ({
  line_id: '00000000-0000-0000-0000-000000000001',
  component_sku: 'HC-9000',
  component_label: 'Hydraulic Controller',
  qty_per_parent_unit: 1,
  qty_required_total: 30,
  source: 'internal_mfg' as const,
  on_hand_qty: null,
  vendor_block: null,
  internal_block: { standard_lt_days: 5, historical_lt: null, live_capacity: null },
  wall_block: null,
  subcomponents: [
    {
      line_id: '00000000-0000-0000-0000-000000000002',
      component_sku: 'ABS-HSG-25',
      component_label: 'ABS Housing',
      qty_per_parent_unit: 1,
      qty_required_total: 30,
      source: 'vendor_stock' as const,
      on_hand_qty: null,
      vendor_block: {
        vendor_participant_id: '00000000-0000-0000-0000-000000000010',
        vendor_sku: 'VEN-A-001',
        mto_reference: null,
        plt_days: 5,
        qlt: null,
        inventory_disclosure: 'exact' as const,
        on_hand_qty_at_vendor: 400,
        historical_lt: null,
      },
      internal_block: null,
      wall_block: null,
      subcomponents: [],
    },
  ],
});

const makeRun = (overrides: Partial<{ status: string; tree: unknown }> = {}) => ({
  run: {
    run_id: 'r1',
    status: overrides.status ?? 'complete',
    completed_at: '2026-05-28T10:00:00Z',
    created_at: '2026-05-28T09:55:00Z',
    initiator_participant_id: 'p1',
    template_id: null,
    run_origin: 'ad_hoc',
    authorization_basis: 'bilateral',
    scope_snapshot: { kind: 'phantom_demand', authorization_basis: 'bilateral', counterparty: 'cp1', skus: ['s1'], hypothetical_quantity: 100, hypothetical_timeline: null },
    hop_budget: 10,
    hops_consumed: 5,
    throttled_at: null,
    resumption_count: 0,
    cancel_requested_at: null,
    cancelled_at: null,
    started_at: '2026-05-28T09:55:30Z',
    triggered_by_user_id: null,
    updated_at: '2026-05-28T10:00:00Z',
  },
  tree: overrides.tree !== undefined ? overrides.tree : makeTree(),
}) as PhantomDemandRunDetail;

describe('RunDetailShell', () => {
  it('renders "Resolving components…" placeholder when tree is null', () => {
    render(<RunDetailShell initialDetail={makeRun({ tree: null })} />);
    expect(screen.getByText(/Resolving components/)).toBeInTheDocument();
  });

  it('renders BomTreeView when tree is present', () => {
    render(<RunDetailShell initialDetail={makeRun()} />);
    expect(screen.getByText('HC-9000')).toBeInTheDocument();
    expect(screen.getByText('Hydraulic Controller')).toBeInTheDocument();
  });

  it('shows "Select a component" placeholder before any node is clicked', () => {
    render(<RunDetailShell initialDetail={makeRun()} />);
    expect(screen.getByText(/Select a component to see details/i)).toBeInTheDocument();
  });

  it('clicking a tree node updates the detail panel', () => {
    render(<RunDetailShell initialDetail={makeRun()} />);
    // Before click: placeholder visible
    expect(screen.getByText(/Select a component/i)).toBeInTheDocument();
    // Click a child node
    fireEvent.click(screen.getByText('ABS-HSG-25'));
    // Detail panel now shows the selected component
    expect(screen.getByText('VEN-A-001')).toBeInTheDocument();
    // Placeholder gone
    expect(screen.queryByText(/Select a component/i)).not.toBeInTheDocument();
  });
});
