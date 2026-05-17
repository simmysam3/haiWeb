import '@testing-library/jest-dom/vitest';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { GapInventoryEntry } from '@/lib/haiwave-api';
import { GapInventory } from '../gap-inventory';
import { makeAggregateReport } from '../__fixtures__/aggregate-report';

const GLH_SUGGESTION =
  'Counterparty has not granted access; request a manifest disclosure.';
function glhEntry(productId: string): GapInventoryEntry {
  return {
    vendor_participant_id: 'v-glh',
    vendor_legal_name: 'Great Lakes Hardware Distribution Inc',
    product_id: productId,
    gap_kind: 'unauthorized',
    resolution_class: 'agentic_eligible',
    declared_country: null,
    depth_level: 3,
    actionable_suggestion: GLH_SUGGESTION,
  };
}

describe('GapInventory', () => {
  it('groups entries by resolution_class and renders one card per group', () => {
    const entries = makeAggregateReport().gap_inventory;
    render(<GapInventory entries={entries} />);
    expect(screen.getByText(/Agentic eligible/i)).toBeInTheDocument();
    expect(screen.getByText(/Out of band/i)).toBeInTheDocument();
    expect(screen.getByText('Vendor A')).toBeInTheDocument();
    expect(screen.getByText('Vendor B')).toBeInTheDocument();
    expect(screen.getByText(/manifest disclosure/i)).toBeInTheDocument();
    expect(screen.getByText(/non-participant/i)).toBeInTheDocument();
  });

  it('renders empty-state copy when no gaps are present', () => {
    render(<GapInventory entries={[]} />);
    expect(screen.getByText(/No gaps surfaced/i)).toBeInTheDocument();
  });

  it('shows the vendor name once and the gap-kind suggestion once when a vendor has many gaps of the same kind', () => {
    render(
      <GapInventory entries={[glhEntry('GLH-1'), glhEntry('GLH-2'), glhEntry('GLH-3')]} />,
    );
    expect(
      screen.getAllByText('Great Lakes Hardware Distribution Inc'),
    ).toHaveLength(1);
    expect(screen.getAllByText(GLH_SUGGESTION)).toHaveLength(1);
    // every product is still listed
    expect(screen.getByText(/GLH-1/)).toBeInTheDocument();
    expect(screen.getByText(/GLH-2/)).toBeInTheDocument();
    expect(screen.getByText(/GLH-3/)).toBeInTheDocument();
  });
});
