import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { BomAccordionTree, stockCoverage, isRedacted } from '../bom-accordion-tree';
import type { BomTree, BomNode, VendorCandidate } from '@haiwave/protocol';

const TARGET = '2026-09-01';

// A candidate that covers the full required qty on time (→ readiness 'ready').
function coveringCandidate(qty: number): VendorCandidate {
  return {
    vendor_participant_id: '00000000-0000-0000-0000-0000000000e1',
    vendor_sku: 'ALT-1',
    relationship_state: 'trading_pair',
    availability: {
      quoted_quantity: qty,
      quoted_timeline: '2026-08-10T00:00:00.000Z',
      confidence: 'high',
      completeness: 'complete',
      on_hand_qty: 0,
      inventory_disclosure: 'sufficient',
    },
    unavailable_reason: null,
  };
}

function root(children: BomNode[], overrides: Partial<BomTree> = {}): BomTree {
  return {
    line_id: '00000000-0000-0000-0000-000000000001',
    component_sku: 'HW-ACT-4400',
    component_label: 'Actuator assembly',
    qty_per_parent_unit: 1,
    qty_required_total: 120,
    source: 'internal_mfg',
    on_hand_qty: null,
    vendor_block: null,
    internal_block: { standard_lt_days: 0, historical_lt: null, live_capacity: null },
    wall_block: null,
    attributes: [],
    alternates: [],
    alternates_status: 'not_evaluated',
    subcomponents: children,
    ...overrides,
  };
}

function redacted(lineId: string, alias: string, overrides: Partial<BomNode> = {}): BomNode {
  return {
    line_id: lineId,
    component_label: 'Vibration monitoring unit',
    qty_per_parent_unit: 1,
    qty_required_total: 120,
    source: 'vendor_stock',
    on_hand_qty: null,
    vendor_block: {
      anonymous_handle: `tier_2_responder_${lineId}`,
      supplier_alias: alias,
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
    attributes: [
      { key: 'voltage_rating', value: '28 VDC', raw_value: '28 VDC', extracted_by: 'classifier' },
      { key: 'fire_rating', value: 'DO-160G', raw_value: 'DO-160G', extracted_by: 'classifier' },
    ],
    alternates: [],
    alternates_status: 'not_evaluated',
    ...overrides,
  };
}

function disclosed(lineId: string, overrides: Partial<BomNode> = {}): BomNode {
  return {
    line_id: lineId,
    component_sku: 'AL-HSG-220',
    component_label: 'Actuator housing',
    qty_per_parent_unit: 1,
    qty_required_total: 120,
    source: 'vendor_stock',
    on_hand_qty: null,
    vendor_block: {
      vendor_participant_id: '00000000-0000-0000-0000-000000000010',
      vendor_sku: 'MC-AH-220-R2',
      vendor_legal_name: 'Meridian Castings',
      mto_reference: null,
      plt_days: 30,
      qlt: null,
      inventory_disclosure: 'exact',
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
    ...overrides,
  };
}

describe('BomAccordionTree — helpers', () => {
  it('stockCoverage classifies full/partial/none', () => {
    expect(stockCoverage(disclosed('l', { on_hand_qty: 140 }))).toBe('full');
    expect(stockCoverage(disclosed('l', { on_hand_qty: 80 }))).toBe('partial');
    expect(stockCoverage(disclosed('l', { on_hand_qty: null }))).toBe('none');
  });
  it('isRedacted detects a vendor block without a participant id', () => {
    expect(isRedacted(redacted('l', 'A'))).toBe(true);
    expect(isRedacted(disclosed('l'))).toBe(false);
  });
});

describe('BomAccordionTree — rows', () => {
  it('(1) a redacted row shows the class label + Supplier A chip and never the sku string', () => {
    const node = redacted('00000000-0000-0000-0000-000000000002', 'A', {
      component_sku: 'T2-SECRET-SKU',
    });
    render(<BomAccordionTree tree={root([node])} targetDate={TARGET} />);
    expect(screen.getByText('Vibration monitoring unit')).toBeInTheDocument();
    expect(screen.getByText('Supplier A')).toBeInTheDocument();
    expect(screen.getByText('28 VDC · DO-160G')).toBeInTheDocument();
    expect(screen.queryByText('T2-SECRET-SKU')).toBeNull();
  });

  it('(2) a full-stock row shows the in-stock pill and NO readiness pill', () => {
    const node = disclosed('00000000-0000-0000-0000-000000000002', {
      on_hand_qty: 140,
      alternates_status: 'has_alternates',
      alternates: [coveringCandidate(120)],
    });
    render(<BomAccordionTree tree={root([node])} targetDate={TARGET} />);
    expect(screen.getByText('✓ in stock · 140')).toBeInTheDocument();
    // readiness would be 'ready' but is suppressed on a fully-covered row
    expect(screen.queryByText('Ready')).toBeNull();
    expect(screen.queryByText('At risk')).toBeNull();
  });

  it('(3) a partial-stock row shows both the partial-stock pill and the readiness pill', () => {
    const node = disclosed('00000000-0000-0000-0000-000000000002', {
      on_hand_qty: 80,
      alternates_status: 'has_alternates',
      alternates: [coveringCandidate(120)],
    });
    render(<BomAccordionTree tree={root([node])} targetDate={TARGET} />);
    expect(screen.getByText('80 of 120')).toBeInTheDocument();
    expect(screen.getByText('Ready')).toBeInTheDocument();
  });

  it('(4) the same hidden vendor under two branches renders Supplier A twice', () => {
    const a1 = redacted('00000000-0000-0000-0000-000000000002', 'A');
    const a2 = redacted('00000000-0000-0000-0000-000000000003', 'A', {
      component_label: 'Sensor harness',
    });
    render(<BomAccordionTree tree={root([a1, a2])} targetDate={TARGET} />);
    expect(screen.getAllByText('Supplier A')).toHaveLength(2);
  });

  it('(5) a wall row shows the not-visible pill', () => {
    const wall: BomNode = {
      line_id: '00000000-0000-0000-0000-000000000002',
      component_label: 'Position sensor',
      qty_per_parent_unit: 1,
      qty_required_total: 120,
      source: 'wall',
      on_hand_qty: null,
      vendor_block: null,
      internal_block: null,
      wall_block: {
        reason: 'posture_opt_out',
        depth_when_hit: 2,
        intended_counterparty: null,
        detail: null,
      },
      subcomponents: [],
      attributes: [],
      alternates: [],
      alternates_status: 'not_evaluated',
    };
    render(<BomAccordionTree tree={root([wall])} targetDate={TARGET} />);
    expect(screen.getByText('not visible')).toBeInTheDocument();
  });

  it('(6) a collapsed parent over a walled child gets the red sliver title', () => {
    const walledChild: BomNode = {
      line_id: '00000000-0000-0000-0000-000000000009',
      component_label: 'Hidden tier',
      qty_per_parent_unit: 1,
      qty_required_total: 120,
      source: 'wall',
      on_hand_qty: null,
      vendor_block: null,
      internal_block: null,
      wall_block: { reason: 'no_bilateral', depth_when_hit: 3, intended_counterparty: null, detail: null },
      subcomponents: [],
      attributes: [],
      alternates: [],
      alternates_status: 'not_evaluated',
    };
    const parent = disclosed('00000000-0000-0000-0000-000000000002', {
      subcomponents: [walledChild],
    });
    render(<BomAccordionTree tree={root([parent])} targetDate={TARGET} />);
    // parent is collapsed by default (only the root is open) — its sliver must
    // roll up the buried wall to red.
    const sliver = screen.getByTitle(/not ready/i);
    expect(sliver).toBeInTheDocument();
  });

  it('(7) clicking a row calls renderBand with the 1.2 line ref and sets aria-expanded', () => {
    const first = disclosed('00000000-0000-0000-0000-000000000002');
    const second = redacted('00000000-0000-0000-0000-000000000003', 'A');
    const renderBand = vi.fn(() => <div data-testid="band" />);
    render(
      <BomAccordionTree tree={root([first, second])} targetDate={TARGET} renderBand={renderBand} />,
    );
    const row = screen.getByText('Vibration monitoring unit').closest('[role="treeitem"]')!;
    expect(row).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(row);
    expect(renderBand).toHaveBeenCalledWith(
      expect.objectContaining({ line_id: '00000000-0000-0000-0000-000000000003' }),
      '1.2',
    );
    expect(row).toHaveAttribute('aria-expanded', 'true');
  });

  it('(8) an internal row shows the internal-mfg pill with its standard lead time', () => {
    const internal: BomNode = {
      line_id: '00000000-0000-0000-0000-000000000002',
      component_sku: 'TI-FST-90',
      component_label: 'Fastener kit',
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
    render(<BomAccordionTree tree={root([internal])} targetDate={TARGET} />);
    expect(screen.getByText('internal mfg · 10d')).toBeInTheDocument();
  });

  it('(9) a tier-2 raw row shows the derived unit capacity', () => {
    const node = redacted('00000000-0000-0000-0000-000000000002', 'A', {
      vendor_block: {
        anonymous_handle: 'tier_2_responder_raw',
        supplier_alias: 'A',
        mto_reference: null,
        plt_days: 45,
        qlt: null,
        inventory_disclosure: 'sufficient',
        on_hand_qty_at_vendor: null,
        historical_lt: null,
        raw_material_status: {
          material_class: 'brass rod',
          on_hand: { qty: 500, uom: 'lb' },
          replenish_lead_days: 14,
          declared_conversion: { units_per_uom: 33 },
        },
      },
    });
    render(<BomAccordionTree tree={root([node])} targetDate={TARGET} />);
    expect(screen.getByText('raw ≈ 16,500 units')).toBeInTheDocument();
  });
});
