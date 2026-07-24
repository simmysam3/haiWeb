import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { PhantomDemandRunDetail } from '@/lib/haiwave-api';
import type { BomNode, BomTree } from '@haiwave/protocol';

// Stub SWR so it never fires real fetch calls in tests. The shell receives
// `initialDetail` as a prop; polling is an integration concern covered by e2e.
vi.mock('swr', () => ({
  default: () => ({ data: undefined, error: undefined }),
}));

import { RunDetailShell } from '../run-detail-shell';

// Root of the BOM snapshot — an internal-mfg assembly from the buyer's own BOM.
function rootWith(children: BomNode[]): BomTree {
  return {
    line_id: '00000000-0000-0000-0000-000000000001',
    component_sku: 'HC-9000',
    component_label: 'Hydraulic Controller',
    qty_per_parent_unit: 1,
    qty_required_total: 30,
    source: 'internal_mfg',
    on_hand_qty: null,
    vendor_block: null,
    internal_block: { standard_lt_days: 5, historical_lt: null, live_capacity: null },
    wall_block: null,
    attributes: [],
    alternates: [],
    alternates_status: 'not_evaluated',
    subcomponents: children,
  };
}

// A properly-redacted upstream node (3.52.0 snapshot shape): vendor identity
// stripped, a run-scoped supplier alias assigned, no component_sku.
function redactedChild(): BomNode {
  return {
    line_id: '00000000-0000-0000-0000-000000000002',
    component_label: 'Vibration monitoring unit',
    qty_per_parent_unit: 1,
    qty_required_total: 30,
    source: 'vendor_stock',
    on_hand_qty: null,
    vendor_block: {
      anonymous_handle: 'tier_2_responder_abcd2345',
      supplier_alias: 'A',
      mto_reference: null,
      plt_days: 45,
      qlt: null,
      inventory_disclosure: 'sufficient',
      on_hand_qty_at_vendor: null,
      historical_lt: null,
      raw_material_status: null,
    },
    internal_block: null,
    wall_block: null,
    subcomponents: [],
    attributes: [],
    alternates: [],
    alternates_status: 'not_evaluated',
  };
}

// A LEGACY snapshot (pre-3.52 redaction) where the vendor id was stripped but
// the component_sku and anonymous_handle were left behind and no supplier_alias
// was ever assigned. The UI must still never render the sku and must show the
// generic "Identity withheld" form — the defensive rule.
function legacyRedactedChild(): BomNode {
  return {
    line_id: '00000000-0000-0000-0000-000000000003',
    component_sku: 'T2-LEAK',
    component_label: 'Undisclosed upstream part',
    qty_per_parent_unit: 1,
    qty_required_total: 30,
    source: 'vendor_stock',
    on_hand_qty: null,
    vendor_block: {
      anonymous_handle: 'tier_2_responder_legacy',
      mto_reference: null,
      plt_days: 45,
      qlt: null,
      inventory_disclosure: 'sufficient',
      on_hand_qty_at_vendor: null,
      historical_lt: null,
      raw_material_status: null,
    },
    internal_block: null,
    wall_block: null,
    subcomponents: [],
    attributes: [],
    alternates: [],
    alternates_status: 'not_evaluated',
  };
}

const makeRun = (tree: BomTree | null): PhantomDemandRunDetail =>
  ({
    run: {
      run_id: 'r1',
      status: 'complete',
      completed_at: '2026-05-28T10:00:00Z',
      created_at: '2026-05-28T09:55:00Z',
      initiator_participant_id: 'p1',
      template_id: null,
      run_origin: 'ad_hoc',
      authorization_basis: 'bilateral',
      scope_snapshot: {
        kind: 'phantom_demand',
        authorization_basis: 'bilateral',
        counterparty: 'cp1',
        skus: ['s1'],
        hypothetical_quantity: 100,
        hypothetical_timeline: null,
        target_date: '2026-09-01',
      },
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
    tree,
  }) as PhantomDemandRunDetail;

describe('RunDetailShell', () => {
  it('renders "Resolving components…" placeholder when tree is null', () => {
    render(<RunDetailShell initialDetail={makeRun(null)} />);
    expect(screen.getByText(/Resolving components/)).toBeInTheDocument();
  });

  it('renders the accordion tree with the root row when tree is present', () => {
    render(<RunDetailShell initialDetail={makeRun(rootWith([]))} />);
    expect(screen.getByText('HC-9000')).toBeInTheDocument();
    expect(screen.getByText('Hydraulic Controller')).toBeInTheDocument();
    expect(screen.getByRole('tree')).toBeInTheDocument();
  });

  it('expanding a redacted row reveals the verified-undisclosed detail band inline', () => {
    render(<RunDetailShell initialDetail={makeRun(rootWith([redactedChild()]))} />);
    // Root is open by default (its own internal-mfg band shows), but the
    // redacted child row is collapsed — its band ("Component class" KV) is not
    // shown yet, and its alias chip appears once (the row only).
    expect(screen.queryByText('Component class')).toBeNull();
    expect(screen.getAllByText('Supplier A')).toHaveLength(1); // row chip only
    fireEvent.click(screen.getByText('Vibration monitoring unit'));
    // Child band now rendered inline beneath the row, with its redacted content.
    expect(screen.getByText('Component class')).toBeInTheDocument();
    // The alias chip now appears in both the row and the band.
    expect(screen.getAllByText('Supplier A').length).toBeGreaterThanOrEqual(2);
  });

  it('never renders a leaked component_sku on a legacy redacted node — row and band show "Identity withheld"', () => {
    render(<RunDetailShell initialDetail={makeRun(rootWith([legacyRedactedChild()]))} />);
    // Row: generic withheld form, sku never rendered.
    expect(screen.getByText('Identity withheld')).toBeInTheDocument();
    expect(screen.queryByText('T2-LEAK')).toBeNull();
    // Expand → band: still withheld, still no sku leak.
    fireEvent.click(screen.getByText('Undisclosed upstream part'));
    expect(screen.getAllByText('Identity withheld').length).toBeGreaterThanOrEqual(2);
    expect(screen.queryByText('T2-LEAK')).toBeNull();
  });
});
