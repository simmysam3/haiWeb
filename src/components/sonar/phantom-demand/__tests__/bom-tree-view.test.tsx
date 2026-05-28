import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { BomTreeView } from '../bom-tree-view';
import type { BomTree } from '@haiwave/protocol';

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
    },
  ],
};

describe('BomTreeView', () => {
  it('renders the root SKU + label', () => {
    render(<BomTreeView tree={tree} selectedLineId={null} onSelect={vi.fn()} />);
    expect(screen.getByText('HC-9000')).toBeInTheDocument();
    expect(screen.getByText('Hydraulic Controller')).toBeInTheDocument();
  });
  it('renders subcomponents recursively', () => {
    render(<BomTreeView tree={tree} selectedLineId={null} onSelect={vi.fn()} />);
    expect(screen.getByText('ABS-HSG-25')).toBeInTheDocument();
  });
  it('calls onSelect with line_id when a node is clicked', () => {
    const onSelect = vi.fn();
    render(<BomTreeView tree={tree} selectedLineId={null} onSelect={onSelect} />);
    fireEvent.click(screen.getByText('ABS-HSG-25'));
    expect(onSelect).toHaveBeenCalledWith('00000000-0000-0000-0000-000000000002');
  });
  it('highlights the selected node', () => {
    const { container } = render(
      <BomTreeView tree={tree} selectedLineId="00000000-0000-0000-0000-000000000002" onSelect={vi.fn()} />,
    );
    const selected = container.querySelector('[aria-selected="true"]');
    expect(selected?.textContent).toContain('ABS-HSG-25');
  });
});
