import '@testing-library/jest-dom/vitest';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { GapDetailEntry } from '@/lib/haiwave-api';
import { GapDetail } from '../gap-detail';
import { makePerVendorReport } from '../__fixtures__/per-vendor-report';

const DETAIL_SUGGESTION =
  'Counterparty has not granted access; request a manifest disclosure or key installation.';
function detailEntry(depth: number): GapDetailEntry {
  return {
    product_id: 'p2',
    sku_label: 'BEARING-7',
    gap_kind: 'unauthorized',
    resolution_class: 'agentic_eligible',
    declared_country: null,
    depth_level: depth,
    actionable_suggestion: DETAIL_SUGGESTION,
  };
}

describe('GapDetail', () => {
  it('renders one section per SKU with gap kind, resolution-class badge, and actionable suggestion', () => {
    const entries = makePerVendorReport().gap_detail;
    render(<GapDetail entries={entries} />);
    expect(screen.getByText('BEARING-7')).toBeInTheDocument();
    expect(screen.getByText(/unauthorized/i)).toBeInTheDocument();
    expect(screen.getByText(/manifest disclosure/i)).toBeInTheDocument();
    expect(screen.getByText(/Agentic eligible/i)).toBeInTheDocument();
  });

  it('renders empty-state copy when no gaps', () => {
    render(<GapDetail entries={[]} />);
    expect(screen.getByText(/No unresolved gaps/i)).toBeInTheDocument();
  });

  it('shows the suggestion once per gap kind even when a SKU has many same-kind gaps', () => {
    render(
      <GapDetail entries={[detailEntry(1), detailEntry(2), detailEntry(3)]} />,
    );
    expect(screen.getAllByText('BEARING-7')).toHaveLength(1);
    expect(screen.getAllByText(DETAIL_SUGGESTION)).toHaveLength(1);
    // each depth is still represented
    expect(screen.getByText(/depth 1/)).toBeInTheDocument();
    expect(screen.getByText(/depth 3/)).toBeInTheDocument();
  });
});
