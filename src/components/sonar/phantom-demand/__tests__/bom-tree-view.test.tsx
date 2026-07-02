import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { BomTreeView } from '../bom-tree-view';
import type { BomTree, BomNode } from '@haiwave/protocol';

const tree: BomTree = {
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
  subcomponents: [
    {
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
        qlt: null,
        inventory_disclosure: 'exact',
        on_hand_qty_at_vendor: 400,
        historical_lt: null,
      },
      internal_block: null,
      wall_block: null,
      subcomponents: [],
      attributes: [],
      alternates: [],
      alternates_status: 'not_evaluated',
    },
  ],
};

describe('BomTreeView', () => {
  it('renders the root SKU + label', () => {
    render(<BomTreeView tree={tree} selectedLineId={null} onSelect={vi.fn()} targetDate="2026-08-01" />);
    expect(screen.getByText('HC-9000')).toBeInTheDocument();
    expect(screen.getByText('Hydraulic Controller')).toBeInTheDocument();
  });
  it('renders subcomponents recursively', () => {
    render(<BomTreeView tree={tree} selectedLineId={null} onSelect={vi.fn()} targetDate="2026-08-01" />);
    expect(screen.getByText('ABS-HSG-25')).toBeInTheDocument();
  });
  it('calls onSelect with line_id when a node is clicked', () => {
    const onSelect = vi.fn();
    render(<BomTreeView tree={tree} selectedLineId={null} onSelect={onSelect} targetDate="2026-08-01" />);
    fireEvent.click(screen.getByText('ABS-HSG-25'));
    expect(onSelect).toHaveBeenCalledWith('00000000-0000-0000-0000-000000000002');
  });
  it('highlights the selected node', () => {
    const { container } = render(
      <BomTreeView tree={tree} selectedLineId="00000000-0000-0000-0000-000000000002" onSelect={vi.fn()} targetDate="2026-08-01" />,
    );
    const selected = container.querySelector('[aria-selected="true"]');
    expect(selected?.textContent).toContain('ABS-HSG-25');
  });
  it('renders a readiness badge on a fanned-out node', () => {
    // reuse the file's tree fixture, but mark the root has_alternates with one covering candidate
    const t = { ...tree, alternates_status: 'has_alternates' as const, alternates: [
      { vendor_participant_id: '00000000-0000-0000-0000-0000000000e1', vendor_sku: 'X', relationship_state: 'trading_pair' as const, availability: { quoted_quantity: tree.qty_required_total, quoted_timeline: '2026-07-01T00:00:00Z', confidence: 'high' as const, completeness: 'complete' as const, on_hand_qty: 0, inventory_disclosure: 'sufficient' as const }, unavailable_reason: null },
    ] };
    render(<BomTreeView tree={t} selectedLineId={null} onSelect={() => {}} targetDate="2026-08-01" />);
    expect(document.querySelector('.text-success')).toBeTruthy();
  });
});

// Regression: the qty column rendered `×{qty_required_total}`, so an exploded
// component (3 brass ingots per blank → 360 from a 120-unit run) showed "×360"
// — larger than the 120 run qty and wearing a multiplier glyph, which read as
// if the run quantity had changed. Surface the true per-parent multiplier and
// label the rolled-up total instead.
const brass: BomNode = {
  line_id: 'l-brass',
  component_sku: 'BRASS-STOCK-APX-BR-CART-15',
  component_label: 'Cartridge brass foundry ingot, C260',
  qty_per_parent_unit: 3,
  qty_required_total: 360,
  source: 'vendor_stock',
  on_hand_qty: 40,
  vendor_block: {
    vendor_participant_id: '00000000-0000-0000-0000-000000000020',
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

const machining: BomNode = {
  line_id: 'l-cnc',
  component_sku: 'APX-MACH-APX-BR-CART-15',
  component_label: 'CNC machining + finishing (internal)',
  qty_per_parent_unit: 1,
  qty_required_total: 120,
  source: 'internal_mfg',
  on_hand_qty: null,
  vendor_block: null,
  internal_block: { standard_lt_days: 10, historical_lt: null, live_capacity: null },
  wall_block: null,
  subcomponents: [],
  attributes: [],
  alternates: [],
  alternates_status: 'not_evaluated',
};

const explodedTree: BomTree = {
  line_id: 'l-root',
  component_sku: 'APX-BR-CART-15',
  component_label: 'Cartridge Valve Body Blank, 1-1/2 in.',
  qty_per_parent_unit: 1,
  qty_required_total: 120,
  source: 'internal_mfg',
  on_hand_qty: null,
  vendor_block: null,
  internal_block: { standard_lt_days: 0, historical_lt: null, live_capacity: null },
  wall_block: null,
  subcomponents: [machining, brass],
  attributes: [],
  alternates: [],
  alternates_status: 'not_evaluated',
};

describe('BomTreeView — multiplier vs total disambiguation', () => {
  it('surfaces the per-parent multiplier and rolled-up total (×3 → 360), not a bare ×360', () => {
    render(<BomTreeView tree={explodedTree} selectedLineId={null} onSelect={vi.fn()} targetDate="2026-08-01" />);
    const node = screen.getByRole('button', { name: /BRASS-STOCK/i });
    expect(node).toHaveTextContent('×3 → 360');
    expect(node).not.toHaveTextContent('×360');
  });

  it('shows 1:1 / run-qty nodes as a plain quantity, never a "×" multiplier', () => {
    render(<BomTreeView tree={explodedTree} selectedLineId={null} onSelect={vi.fn()} targetDate="2026-08-01" />);
    const root = screen.getByRole('button', { name: /Cartridge Valve Body Blank/i });
    expect(root).toHaveTextContent('120');
    expect(root).not.toHaveTextContent('×120');
    const cnc = screen.getByRole('button', { name: /CNC machining/i });
    expect(cnc).toHaveTextContent('120');
    expect(cnc).not.toHaveTextContent('×120');
  });
});
