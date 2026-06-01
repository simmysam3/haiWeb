import { describe, it, expect } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { AuditRun, AuditRunResult, ObservationNode } from '@haiwave/protocol';
import { TierGapGrid } from '../tier-gap-grid';

// Minimal ObservationNode / AuditRunResult fixtures. The component only reads
// `tree.{gap, depth_level, components, vendor_legal_name, payload}` and the
// result's `{product_id, result_id, vendor_participant_id}`, so we build just
// those and cast (the full protocol shapes carry many unrelated fields).
function node(
  depth: number,
  gap: boolean,
  children: ObservationNode[] = [],
  vendor = '',
): ObservationNode {
  return {
    depth_level: depth,
    gap: gap ? { kind: 'unauthorized' } : null,
    components: children,
    vendor_legal_name: vendor || null,
    payload: { kind: 'audit', origin: { vendor_name: vendor } },
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
