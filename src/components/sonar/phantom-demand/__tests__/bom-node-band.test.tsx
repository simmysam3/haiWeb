import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { BomNodeBand } from '../bom-node-band';
import type { BomNode } from '@haiwave/protocol';

const TARGET = '2026-09-01';
const PROBE_UUID = '00000000-0000-0000-0000-0000000000f0';

// A full responder_-prefixed probe response — the exact shape haiCore persists
// into vendor_block.qlt. The OLD BomNodeDetail guard checked the un-prefixed
// field names (quoted_timeline/confidence) and therefore never matched this,
// silently dropping the live quote. This band safeParses the real schema.
const prefixedQlt = {
  probe_id: PROBE_UUID,
  responder_quoted_quantity: 120,
  responder_quoted_timeline: '2026-08-30T00:00:00.000Z',
  responder_confidence: 'high',
  responder_completeness: 'complete',
  free_text_response: null,
  inventory_disclosure: 'sufficient',
  on_hand_qty: null,
};

function disclosedNode(overrides: Partial<BomNode> = {}): BomNode {
  return {
    line_id: '00000000-0000-0000-0000-000000000011',
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
      qlt: {
        probe_id: PROBE_UUID,
        responder_quoted_quantity: 120,
        responder_quoted_timeline: '2026-08-12T00:00:00.000Z',
        responder_confidence: 'high',
        responder_completeness: 'complete',
        free_text_response: null,
        inventory_disclosure: 'exact',
        on_hand_qty: 140,
      },
      inventory_disclosure: 'exact',
      on_hand_qty_at_vendor: 140,
      historical_lt: { p50: 28, p75: 31, p90: 39, sample_count: 18, last_observed_at: null },
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

function redactedNode(overrides: Partial<BomNode> = {}): BomNode {
  return {
    line_id: '00000000-0000-0000-0000-000000000022',
    component_label: 'Vibration monitoring unit',
    qty_per_parent_unit: 1,
    qty_required_total: 120,
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
    attributes: [
      { key: 'voltage_rating', value: '28 VDC', raw_value: '28 VDC', extracted_by: 'classifier' },
      { key: 'fire_rating', value: 'DO-160G', raw_value: 'DO-160G', extracted_by: 'classifier' },
    ],
    alternates: [],
    alternates_status: 'not_evaluated',
    ...overrides,
  };
}

function internalNode(overrides: Partial<BomNode> = {}): BomNode {
  return {
    line_id: '00000000-0000-0000-0000-000000000033',
    component_sku: 'TI-FST-90',
    component_label: 'Fastener kit',
    qty_per_parent_unit: 1,
    qty_required_total: 120,
    source: 'internal_mfg',
    on_hand_qty: null,
    vendor_block: null,
    internal_block: {
      standard_lt_days: 10,
      historical_lt: { p50: 9, p75: 11, p90: 14, sample_count: 41, last_observed_at: null },
      live_capacity: null,
    },
    wall_block: null,
    subcomponents: [],
    attributes: [],
    alternates: [],
    alternates_status: 'not_evaluated',
    ...overrides,
  };
}

function wallNode(overrides: Partial<BomNode> = {}): BomNode {
  return {
    line_id: '00000000-0000-0000-0000-000000000044',
    component_label: 'Position sensor',
    qty_per_parent_unit: 1,
    qty_required_total: 120,
    source: 'wall',
    on_hand_qty: null,
    vendor_block: null,
    internal_block: null,
    wall_block: { reason: 'posture_opt_out', depth_when_hit: 2, intended_counterparty: null, detail: null },
    subcomponents: [],
    attributes: [],
    alternates: [],
    alternates_status: 'not_evaluated',
    ...overrides,
  };
}

describe('BomNodeBand', () => {
  it('disclosed vendor: header name + IdChip + their SKU, published LT, live quote, historical, inventory', () => {
    render(<BomNodeBand node={disclosedNode()} targetDate={TARGET} lineRef="1.1" />);
    expect(screen.getByText('Meridian Castings')).toBeInTheDocument();
    expect(screen.getByText('MC-AH-220-R2')).toBeInTheDocument(); // their SKU disclosed
    expect(screen.getByText('Published lead time')).toBeInTheDocument();
    expect(screen.getByText('Live quote')).toBeInTheDocument();
    expect(screen.getByText(/2026-08-12/)).toBeInTheDocument();
    expect(screen.getByText(/p50 28d · p75 31d · p90 39d/)).toBeInTheDocument();
    expect(screen.getByText(/140 on hand/)).toBeInTheDocument();
  });

  it('redacted node: alias chip + identity-withheld header, component class + attributes, never the sku', () => {
    render(
      <BomNodeBand node={redactedNode({ component_sku: 'T2-LEAK' })} targetDate={TARGET} lineRef="1.2" />,
    );
    expect(screen.getByText('Supplier A')).toBeInTheDocument();
    expect(screen.getByText(/line 1\.2/)).toBeInTheDocument(); // identity-withheld caption line
    expect(screen.getByText('Component class')).toBeInTheDocument();
    expect(screen.getByText('Vibration monitoring unit')).toBeInTheDocument();
    expect(screen.getByText('28 VDC · DO-160G')).toBeInTheDocument();
    expect(screen.queryByText('T2-LEAK')).toBeNull();
  });

  it('internal node: Internal-manufacturing header + standard LT + MES-unavailable live capacity', () => {
    render(<BomNodeBand node={internalNode()} targetDate={TARGET} lineRef="1.3" />);
    expect(screen.getByText('Internal manufacturing')).toBeInTheDocument();
    expect(screen.getByText('Standard lead time')).toBeInTheDocument();
    expect(screen.getByText(/p50 9d · p90 14d/)).toBeInTheDocument();
    expect(screen.getByText('MES unavailable')).toBeInTheDocument();
  });

  it('wall node: red band with plain-language posture opt-out body', () => {
    render(<BomNodeBand node={wallNode()} targetDate={TARGET} lineRef="1.4" />);
    expect(screen.getByText('Supply not visible past this point')).toBeInTheDocument();
    expect(screen.getByText(/opted out of phantom-demand disclosure/i)).toBeInTheDocument();
    expect(screen.getByText(/posture choice, not a data failure/i)).toBeInTheDocument();
  });

  it('raw material tier 1: material + on-hand + replenishment, no derived capacity', () => {
    const node = redactedNode({
      vendor_block: {
        anonymous_handle: 'tier_2_responder_raw1',
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
          declared_conversion: null,
        },
      },
    });
    render(<BomNodeBand node={node} targetDate={TARGET} lineRef="1.2" />);
    expect(screen.getByText('Raw material')).toBeInTheDocument();
    expect(screen.getByText('brass rod')).toBeInTheDocument();
    expect(screen.getByText(/500 lb/)).toBeInTheDocument();
    expect(screen.queryByText(/≈/)).toBeNull(); // no declared conversion → no derived units
  });

  it('raw material tier 2: declared conversion yields a vendor-declared derived capacity', () => {
    const node = redactedNode({
      vendor_block: {
        anonymous_handle: 'tier_2_responder_raw2',
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
    render(<BomNodeBand node={node} targetDate={TARGET} lineRef="1.2" />);
    expect(screen.getByText(/≈ 16,500 units/)).toBeInTheDocument();
    expect(screen.getByText(/vendor-declared/i)).toBeInTheDocument();
  });

  it('full-stock lead: reads "Covered from your on-hand stock"', () => {
    render(<BomNodeBand node={disclosedNode({ on_hand_qty: 140 })} targetDate={TARGET} lineRef="1.1" />);
    expect(screen.getByText(/Covered from your on-hand stock/i)).toBeInTheDocument();
  });

  it('alternates: named vendor + IdChip + availability + completeness pill, with the readiness reason line', () => {
    const node = redactedNode({
      alternates_status: 'has_alternates',
      alternates: [
        {
          vendor_participant_id: '00000000-0000-0000-0000-0000000000e2',
          vendor_sku: 'VM-2210-B',
          vendor_legal_name: 'Nordica Sensors',
          relationship_state: 'trading_pair',
          availability: {
            quoted_quantity: 120,
            quoted_timeline: '2026-09-04T00:00:00.000Z',
            confidence: 'high',
            completeness: 'complete',
            on_hand_qty: 0,
            inventory_disclosure: 'sufficient',
          },
          unavailable_reason: null,
        },
      ],
    });
    render(<BomNodeBand node={node} targetDate={TARGET} lineRef="1.2" />);
    expect(screen.getByText(/Interchangeable vendors/i)).toBeInTheDocument();
    expect(screen.getByText('Nordica Sensors')).toBeInTheDocument(); // vendor_legal_name renders
    expect(screen.getByText('VM-2210-B')).toBeInTheDocument();
    expect(screen.getByText(/120 by 2026-09-04/)).toBeInTheDocument();
    // timeline_slip: covered on quantity, delivery lands after the target date
    expect(screen.getByTestId('readiness-reason')).toHaveTextContent(/delivery lands after the target date/i);
  });

  it('alternates empty-state: preserves the "no interchangeable trading pair" copy', () => {
    const node = redactedNode({ alternates_status: 'no_interchangeable_trading_pair', alternates: [] });
    render(<BomNodeBand node={node} targetDate={TARGET} lineRef="1.2" />);
    expect(
      screen.getByText(/No interchangeable trading pair matched this component/i),
    ).toBeInTheDocument();
  });

  it('qlt-fix regression: renders Live quote from a responder_-prefixed probe response', () => {
    // The OLD BomNodeDetail guard (probe_id + quoted_timeline + confidence) would
    // have dropped this — the persisted shape is responder_-prefixed.
    const node = redactedNode({
      vendor_block: {
        anonymous_handle: 'tier_2_responder_qlt',
        supplier_alias: 'A',
        mto_reference: null,
        plt_days: 45,
        qlt: prefixedQlt,
        inventory_disclosure: 'sufficient',
        on_hand_qty_at_vendor: null,
        historical_lt: null,
        raw_material_status: null,
      },
    });
    render(<BomNodeBand node={node} targetDate={TARGET} lineRef="1.2" />);
    expect(screen.getByText('Live quote')).toBeInTheDocument();
    expect(screen.getByText(/2026-08-30/)).toBeInTheDocument();
  });

  it('does not emit a Pill missing-definition console.warn', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    render(<BomNodeBand node={disclosedNode()} targetDate={TARGET} lineRef="1.1" />);
    render(
      <BomNodeBand
        node={redactedNode({
          alternates_status: 'has_alternates',
          alternates: [
            {
              vendor_participant_id: '00000000-0000-0000-0000-0000000000e3',
              vendor_sku: 'ALT-X',
              relationship_state: 'trading_pair',
              availability: {
                quoted_quantity: 60,
                quoted_timeline: '2026-08-20T00:00:00.000Z',
                confidence: 'medium',
                completeness: 'partial',
                on_hand_qty: 0,
                inventory_disclosure: 'sufficient',
              },
              unavailable_reason: null,
            },
          ],
        })}
        targetDate={TARGET}
        lineRef="1.2"
      />,
    );
    const pillWarns = warn.mock.calls.filter((c) => String(c[0]).includes('[Pill]'));
    expect(pillWarns).toEqual([]);
    warn.mockRestore();
  });
});
