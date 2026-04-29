import '@testing-library/jest-dom/vitest';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { GapsTable } from '../gaps-table';
import type { DownstreamGapEntry } from '@haiwave/protocol';

const entry = (e: Partial<DownstreamGapEntry>): DownstreamGapEntry => ({
  sku_label: 'GASKET-2',
  product_id: 'p2',
  internal_subtier_vendor_id: null,
  internal_subtier_vendor_name: null,
  request_count: 3,
  upstream_observer_ids: ['p-acme', 'p-globex'],
  resolution_class: 'pending',
  estimated_resolution_path: 'Awaiting subtier',
  on_network_status: 'invited',
  ...e,
});

describe('GapsTable', () => {
  it('renders rows in request_count desc order', () => {
    render(
      <GapsTable
        entries={[
          entry({ sku_label: 'A', request_count: 2 }),
          entry({ sku_label: 'B', request_count: 5 }),
          entry({ sku_label: 'C', request_count: 3 }),
        ]}
      />,
    );
    const rows = screen.getAllByRole('row').slice(1);
    expect(rows[0]).toHaveTextContent('B');
    expect(rows[1]).toHaveTextContent('C');
    expect(rows[2]).toHaveTextContent('A');
  });

  it('renders em dash for null subtier vendor with tooltip', () => {
    render(<GapsTable entries={[entry({})]} />);
    const cell = screen.getByText('—');
    expect(cell).toHaveAttribute('title', expect.stringMatching(/future release/i));
  });

  it('renders resolution class badge with appropriate label', () => {
    render(<GapsTable entries={[entry({ resolution_class: 'agentic_eligible' })]} />);
    expect(screen.getByText('agentic_eligible')).toBeInTheDocument();
  });
});
