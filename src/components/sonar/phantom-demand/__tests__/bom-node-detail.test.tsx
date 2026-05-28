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
};

describe('BomNodeDetail', () => {
  it('renders SKU + label + qty', () => {
    render(<BomNodeDetail node={vendorNode} />);
    expect(screen.getByText('ABS-HSG-25')).toBeInTheDocument();
    expect(screen.getByText(/qty required: 30/i)).toBeInTheDocument();
  });
  it('renders vendor identity + PLT + QLT + historical', () => {
    render(<BomNodeDetail node={vendorNode} />);
    expect(screen.getByText('VEN-A-001')).toBeInTheDocument();
    expect(screen.getByText(/5 days/)).toBeInTheDocument();        // PLT
    expect(screen.getByText(/p50: 5d/)).toBeInTheDocument();        // historical
    expect(screen.getByText(/p90: 7d/)).toBeInTheDocument();
  });
  it('renders on_hand when disclosure=exact', () => {
    render(<BomNodeDetail node={vendorNode} />);
    expect(screen.getByText(/400/)).toBeInTheDocument();
  });
  it('renders wall reason when wall_block present', () => {
    const wallNode: BomNode = {
      ...vendorNode,
      source: 'vendor_stock',
      vendor_block: null,
      wall_block: { reason: 'no_bilateral', depth_when_hit: 1, intended_counterparty: null, detail: null },
    };
    render(<BomNodeDetail node={wallNode} />);
    expect(screen.getByText(/no bilateral access/i)).toBeInTheDocument();
  });
});
