import { describe, it, expect } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { AuditRun, AuditRunResult, ObservationNode } from '@haiwave/protocol';
import { TierGapGrid, isVendorLevelGap } from '../tier-gap-grid';

// Minimal ObservationNode / AuditRunResult fixtures. The component only reads
// `tree.{gap, depth_level, components, vendor_legal_name, payload}` and the
// result's `{product_id, result_id, vendor_participant_id}`, so we build just
// those and cast (the full protocol shapes carry many unrelated fields).
function node(
  depth: number,
  gap: boolean,
  children: ObservationNode[] = [],
  vendor = '',
  hint?: string,
): ObservationNode {
  return {
    depth_level: depth,
    gap: gap ? { kind: 'unauthorized', ...(hint ? { hint } : {}) } : null,
    components: children,
    vendor_legal_name: vendor || null,
    // operational_status/class_ids included because the per-SKU evidence
    // accordion now mounts the real TreeView, which reads them.
    payload: {
      kind: 'audit',
      product_id: null,
      disclosure_data: null,
      class_ids: [],
      origin: {
        vendor_name: vendor, country_of_origin: 'US', state_province: null,
        city: null, plant_address: null, plant_identifier: null,
      },
      operational_status: { lead_time_meets: null, capacity: null, delivery_state: null },
    },
  } as unknown as ObservationNode;
}

function result(
  productId: string,
  vendorId: string,
  tree: ObservationNode,
): AuditRunResult {
  return {
    result_id: `res-${productId}`,
    product_id: productId,
    vendor_participant_id: vendorId,
    geo_rollup: [],
    tree,
  } as unknown as AuditRunResult;
}

const RUN = {
  depth_limit: 3,
  hop_count: 12,
  gap_count: 4,
} as unknown as AuditRun;

// Acme: ACME-1 root gap (T1=5) + ACME-2 child gap (T2=3) → 8.
// Beta:  BETA-1 root gap (T1=5) + grandchild gap (T3=2) → 7; BETA-2 clean → 0.
// Run total tiers → T1:2, T2:1, T3:1 → 2×5 + 1×3 + 1×2 = 15.
const FIXTURE: AuditRunResult[] = [
  result('ACME-1', 'p-acme', node(1, true, [], 'Acme')),
  result('ACME-2', 'p-acme', node(1, false, [node(2, true, [], 'Acme')], 'Acme')),
  result('BETA-1', 'p-beta', node(1, true, [node(2, false, [node(3, true)])], 'Beta')),
  result('BETA-2', 'p-beta', node(1, false, [], 'Beta')),
];

describe('TierGapGrid', () => {
  it('renders the run-wide weighted priority score (T1×5/T2×3/T3×2/T4+×1)', () => {
    render(<TierGapGrid run={RUN} results={FIXTURE} />);
    expect(screen.getByText('15')).toBeInTheDocument();
    expect(screen.getAllByText('pts').length).toBeGreaterThan(0);
  });

  it('shows the unified status bar with run-level counts', () => {
    render(<TierGapGrid run={RUN} results={FIXTURE} />);
    // 2 vendors, 4 SKUs, depth 3, hops 12, gaps 4 — all in one bar.
    expect(screen.getByText('Vendors')).toBeInTheDocument();
    expect(screen.getByText('Hops')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText(/Direct \(tier-1\) vendors audited/)).toBeInTheDocument();
  });

  it('buckets gaps into the run-wide tier bar (T1:2)', () => {
    render(<TierGapGrid run={RUN} results={FIXTURE} />);
    // T1:2 is unique to the run-wide rollup (per-vendor bars top out at T1:1).
    expect(screen.getByLabelText('Tier 1: 2')).toBeInTheDocument();
  });

  it('orders vendors by follow-up priority by default (worst first)', () => {
    const { container } = render(<TierGapGrid run={RUN} results={FIXTURE} />);
    const text = container.textContent ?? '';
    // Acme (score 8) ranks above Beta (score 7).
    expect(text.indexOf('Acme')).toBeLessThan(text.indexOf('Beta'));
    for (const sku of ['ACME-1', 'ACME-2', 'BETA-1', 'BETA-2']) {
      expect(screen.getByText(sku)).toBeInTheDocument();
    }
  });

  it('re-orders vendors alphabetically when Order-by is set to Vendor', () => {
    // Use a fixture where priority and alpha order DISAGREE: Zeta outscores Alpha.
    const reversed: AuditRunResult[] = [
      result('Z-1', 'p-zeta', node(1, true, [node(2, true)], 'Zeta')), // score 8
      result('A-1', 'p-alpha', node(1, true, [], 'Alpha')), // score 5
    ];
    const { container, rerender } = render(
      <TierGapGrid run={RUN} results={reversed} />,
    );
    let text = container.textContent ?? '';
    expect(text.indexOf('Zeta')).toBeLessThan(text.indexOf('Alpha')); // priority

    fireEvent.change(screen.getByLabelText('Order vendors by'), {
      target: { value: 'vendor' },
    });
    rerender(<TierGapGrid run={RUN} results={reversed} />);
    text = container.textContent ?? '';
    expect(text.indexOf('Alpha')).toBeLessThan(text.indexOf('Zeta')); // A–Z
  });

  it('filters by the search box', () => {
    render(<TierGapGrid run={RUN} results={FIXTURE} />);
    fireEvent.change(screen.getByLabelText('Search by product or vendor'), {
      target: { value: 'beta' },
    });
    expect(screen.queryByText('ACME-1')).not.toBeInTheDocument();
    expect(screen.getByText('BETA-1')).toBeInTheDocument();
  });

  it('renders an empty state with a zero priority score when there are no results', () => {
    render(<TierGapGrid run={RUN} results={[]} />);
    expect(
      screen.getByText('No results recorded for this run.'),
    ).toBeInTheDocument();
    // No gaps anywhere → the priority rollup shows an em-dash bar and a plain
    // "0" pill (no "pts" suffix, which only renders for non-zero scores).
    expect(screen.getByText('—')).toBeInTheDocument();
    expect(screen.queryByText('pts')).not.toBeInTheDocument();
  });
});

describe('TierGapGrid per-SKU evidence tree accordion', () => {
  it('keeps each SKU evidence tree collapsed behind a "View evidence tree" row', () => {
    render(<TierGapGrid run={RUN} results={FIXTURE} />);
    // One expander per SKU row (4 SKUs).
    const toggles = screen.getAllByRole('button', { name: /view evidence tree/i });
    expect(toggles).toHaveLength(4);
    toggles.forEach((t) => expect(t).toHaveAttribute('aria-expanded', 'false'));
  });

  it('expands a single SKU evidence tree on click and collapses it again', () => {
    render(
      <TierGapGrid
        run={RUN}
        results={[
          result('ACME-1', 'p-acme', node(1, false, [], 'Acme Gary Works')),
        ]}
      />,
    );
    const toggle = screen.getByRole('button', { name: /view evidence tree/i });
    // Tree content not mounted while collapsed. Probe "depth N" rows — unique
    // to TreeView; the group header already carries the vendor name.
    expect(screen.queryByText('depth 1')).toBeNull();

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('depth 1')).toBeInTheDocument();

    fireEvent.click(toggle);
    expect(screen.queryByText('depth 1')).toBeNull();
  });
});

describe('TierGapGrid domestic flag', () => {
  const usRollup = [
    { country_of_origin: 'US', component_count: 2, depth_distribution: { 1: 2 } },
  ];
  const mixedRollup = [
    { country_of_origin: 'US', component_count: 1, depth_distribution: { 1: 1 } },
    { country_of_origin: 'XX', component_count: 1, depth_distribution: { 2: 1 } },
  ];
  const withRollup = (r: AuditRunResult, geo: unknown): AuditRunResult =>
    ({ ...r, geo_rollup: geo }) as AuditRunResult;

  it('flags fully-domestic SKU rows with the auditor-country flag', () => {
    render(
      <TierGapGrid
        run={RUN}
        auditorCountry="US"
        results={[
          withRollup(result('ACME-1', 'p-acme', node(1, false, [], 'Acme')), usRollup),
          withRollup(result('ACME-2', 'p-acme', node(1, false, [], 'Acme')), mixedRollup),
        ]}
      />,
    );
    expect(
      screen.getAllByLabelText('All components verified US-origin'),
    ).toHaveLength(1);
  });

  it('renders no SKU flags without auditorCountry', () => {
    render(
      <TierGapGrid
        run={RUN}
        results={[
          withRollup(result('ACME-1', 'p-acme', node(1, false, [], 'Acme')), usRollup),
        ]}
      />,
    );
    expect(screen.queryByLabelText(/verified .*-origin/i)).toBeNull();
  });
});

describe('isVendorLevelGap', () => {
  it('is true for a root-gap/no-children result (the direct vendor never answered)', () => {
    const r = result('R-1', 'p-x', node(1, true, [], 'X'));
    expect(isVendorLevelGap(r)).toBe(true);
  });

  it('is false when the root is fine and a deeper child carries the gap', () => {
    const r = result('R-2', 'p-x', node(1, false, [node(2, true, [], 'X')], 'X'));
    expect(isVendorLevelGap(r)).toBe(false);
  });

  it('is false for a root gap that still has children (partial disclosure, still per-SKU)', () => {
    const r = result('R-3', 'p-x', node(1, true, [node(2, false, [], 'X')], 'X'));
    expect(isVendorLevelGap(r)).toBe(false);
  });
});

describe('TierGapGrid vendor-level gap collapse', () => {
  it('collapses three vendor-level gaps for the same vendor into one 5pt group score (and run total)', () => {
    const unreachableVendor: AuditRunResult[] = [
      result('U-1', 'p-un', node(1, true, [], 'Unreachable Co', 'responder_unreachable')),
      result('U-2', 'p-un', node(1, true, [], 'Unreachable Co', 'responder_unreachable')),
      result('U-3', 'p-un', node(1, true, [], 'Unreachable Co', 'responder_unreachable')),
    ];
    render(<TierGapGrid run={RUN} results={unreachableVendor} />);
    // Only ONE ScorePill's worth of "5" should show: the group pill and the
    // run-total pill both read 5, not 15.
    expect(screen.getAllByText('5')).toHaveLength(2);
    expect(screen.queryByText('15')).not.toBeInTheDocument();
  });

  it('adds the one-time vendor gap (5) to real per-SKU scoring (3) for a mixed vendor: 8, not more', () => {
    const mixed: AuditRunResult[] = [
      result('U-1', 'p-un', node(1, true, [], 'Unreachable Co', 'responder_unreachable')),
      result('U-2', 'p-un', node(1, true, [], 'Unreachable Co', 'responder_unreachable')),
      // Real tier-2 gap: root fine, child at depth 2 has a gap → T2×3 = 3.
      result('U-3', 'p-un', node(1, false, [node(2, true, [], 'Unreachable Co')], 'Unreachable Co')),
    ];
    render(<TierGapGrid run={RUN} results={mixed} />);
    // Group pill and run-total pill both read 8 (5 + 3), exactly once each.
    expect(screen.getAllByText('8')).toHaveLength(2);
  });

  it('counts a vendor-level gap once PER VENDOR: two unreachable vendors → total 10, not 5', () => {
    const twoVendors: AuditRunResult[] = [
      result('U-1', 'p-un', node(1, true, [], 'Unreachable Co', 'responder_unreachable')),
      result('U-2', 'p-un', node(1, true, [], 'Unreachable Co', 'responder_unreachable')),
      result('V-1', 'p-vn', node(1, true, [], 'Vanished Co', 'responder_unreachable')),
      result('V-2', 'p-vn', node(1, true, [], 'Vanished Co', 'responder_unreachable')),
    ];
    render(<TierGapGrid run={RUN} results={twoVendors} />);
    // Two group pills at 5 each, one run-total pill at 10.
    expect(screen.getAllByText('5')).toHaveLength(2);
    expect(screen.getByText('10')).toBeInTheDocument();
  });

  it('shows a muted "Vendor did not respond" note (no own pts pill) on a vendor-level SKU row, and a group-summary hint', () => {
    render(
      <TierGapGrid
        run={RUN}
        results={[
          result(
            'U-1',
            'p-un',
            node(1, true, [], 'Unreachable Co', 'responder_unreachable'),
          ),
        ]}
      />,
    );
    const note = screen.getByText('Vendor did not respond');
    expect(note).toBeInTheDocument();
    expect(note).toHaveAttribute('title', 'Unauthorized · responder unreachable');
    // No per-row "pts" pill for this SKU — only the group summary's and the
    // run total's ScorePill ("5 pts" each) render "pts" on the page.
    expect(screen.getAllByText('pts')).toHaveLength(2);
    expect(screen.getByText(/vendor did not respond/)).toBeInTheDocument();
  });
});
