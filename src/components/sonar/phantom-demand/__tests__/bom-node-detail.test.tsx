import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { BomNodeDetail } from '../bom-node-detail';
import type { BomNode } from '@haiwave/protocol';

const vendorNode: BomNode = {
  line_id: '00000000-0000-0000-0000-000000000002',
  component_sku: 'ABS-HSG-25',
  component_label: 'ABS Housing',
  qty_per_parent_unit: 1,
  qty_required_total: 30,
  source: 'vendor_stock',
  on_hand_qty: null,
  vendor_block: {
    vendor_participant_id: '00000000-0000-0000-0000-000000000010',
    vendor_sku: 'VEN-A-001',
    mto_reference: null,
    plt_days: 5,
    qlt: {
      probe_id: 'p1',
      sku_id: 'VEN-A-001',
      quoted_quantity: 30,
      quoted_timeline: '2026-06-10',
      confidence: 'medium',
      completeness: 'complete',
      free_text: null,
      inventory_disclosure: 'exact',
      on_hand_qty: 400,
    },
    inventory_disclosure: 'exact',
    on_hand_qty_at_vendor: 400,
    historical_lt: { p50: 5, p75: 6, p90: 7, sample_count: 18, last_observed_at: null },
  },
  internal_block: null,
  wall_block: null,
  subcomponents: [],
  attributes: [],
  alternates: [],
  alternates_status: 'not_evaluated',
};

describe('BomNodeDetail', () => {
  it('renders SKU + label + qty', () => {
    render(<BomNodeDetail node={vendorNode} targetDate="2026-08-01" />);
    expect(screen.getByText('ABS-HSG-25')).toBeInTheDocument();
    expect(screen.getByText(/qty required: 30/i)).toBeInTheDocument();
  });
  it('renders vendor identity + PLT + QLT + historical', () => {
    render(<BomNodeDetail node={vendorNode} targetDate="2026-08-01" />);
    expect(screen.getByText('VEN-A-001')).toBeInTheDocument();
    expect(screen.getByText(/5 days/)).toBeInTheDocument();        // PLT
    expect(screen.getByText(/p50: 5d/)).toBeInTheDocument();        // historical
    expect(screen.getByText(/p90: 7d/)).toBeInTheDocument();
  });
  it('renders on_hand when disclosure=exact', () => {
    render(<BomNodeDetail node={vendorNode} targetDate="2026-08-01" />);
    expect(screen.getByText(/400/)).toBeInTheDocument();
  });
  it('renders wall reason when wall_block present', () => {
    const wallNode: BomNode = {
      ...vendorNode,
      source: 'vendor_stock',
      vendor_block: null,
      wall_block: { reason: 'no_bilateral', depth_when_hit: 1, intended_counterparty: null, detail: null },
    };
    render(<BomNodeDetail node={wallNode} targetDate="2026-08-01" />);
    expect(screen.getByText(/no bilateral access/i)).toBeInTheDocument();
  });
});

describe('BomNodeDetail — exploded-component quantity breakdown', () => {
  const brassNode: BomNode = {
    line_id: '00000000-0000-0000-0000-000000000099',
    component_sku: 'BRASS-STOCK-APX-BR-CART-15',
    component_label: 'Cartridge brass foundry ingot, C260',
    qty_per_parent_unit: 3,
    qty_required_total: 360,
    source: 'vendor_stock',
    on_hand_qty: 40,
    vendor_block: {
      vendor_participant_id: '00000000-0000-0000-0000-000000000010',
      vendor_sku: 'USS-ING-BR-CART-100',
      mto_reference: null,
      plt_days: null,
      qlt: null,
      inventory_disclosure: 'exact',
      on_hand_qty_at_vendor: 0,
      historical_lt: null,
    },
    internal_block: null,
    wall_block: null,
    subcomponents: [],
    attributes: [],
    alternates: [],
    alternates_status: 'not_evaluated',
  };

  it('shows the rolled-up total AND the per-parent multiplier for an exploded component', () => {
    render(<BomNodeDetail node={brassNode} targetDate="2026-08-01" />);
    expect(screen.getByText(/qty required: 360/i)).toBeInTheDocument();
    expect(screen.getByText(/×3 per parent/i)).toBeInTheDocument();
  });

  it('omits the per-parent breakdown for a 1:1 component', () => {
    render(<BomNodeDetail node={vendorNode} targetDate="2026-08-01" />);
    expect(screen.getByText(/qty required: 30/i)).toBeInTheDocument();
    expect(screen.queryByText(/per parent/i)).toBeNull();
  });
});

const alternatesNode: BomNode = {
  line_id: '00000000-0000-0000-0000-0000000000cc', component_sku: 'LACE-9', component_label: 'Lace',
  qty_per_parent_unit: 1, qty_required_total: 30, source: 'vendor_stock', on_hand_qty: null,
  vendor_block: { vendor_participant_id: '00000000-0000-0000-0000-0000000000d1', vendor_sku: 'INC', mto_reference: null, plt_days: null, qlt: null, inventory_disclosure: 'not_disclosed', on_hand_qty_at_vendor: null, historical_lt: null },
  internal_block: null, wall_block: null, subcomponents: [], attributes: [],
  alternates_status: 'has_alternates',
  alternates: [
    { vendor_participant_id: '00000000-0000-0000-0000-0000000000d1', vendor_sku: 'INC', relationship_state: 'trading_pair', availability: { quoted_quantity: 30, quoted_timeline: '2026-07-15T00:00:00Z', confidence: 'high', completeness: 'complete', on_hand_qty: 100, inventory_disclosure: 'sufficient' }, unavailable_reason: null },
    { vendor_participant_id: '00000000-0000-0000-0000-0000000000d2', vendor_sku: 'ALT', relationship_state: 'trading_pair', availability: null, unavailable_reason: 'declined_by_seller' },
  ],
};

describe('BomNodeDetail — interchangeable vendors', () => {
  it('renders the verdict pill and the alternates list', () => {
    render(<BomNodeDetail node={alternatesNode} targetDate="2026-08-01" />);
    expect(screen.getByText(/interchangeable vendors/i)).toBeInTheDocument();
    expect(screen.getByText('ALT')).toBeInTheDocument();               // an alternate sku
    expect(screen.getByText(/declined by seller/i)).toBeInTheDocument(); // unavailable_reason surfaced
  });
});
