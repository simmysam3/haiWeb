import '@testing-library/jest-dom/vitest';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SkuTable } from '../sku-table';
import { makePerVendorReport } from '../__fixtures__/per-vendor-report';

describe('SkuTable', () => {
  it('renders one row per SKU with status badge, manifest version, gap count, and class badge', () => {
    const rows = makePerVendorReport().sku_table;
    render(<SkuTable rows={rows} />);
    const dataRows = screen.getAllByRole('row').slice(1);
    expect(dataRows[0]).toHaveTextContent('GASKET-2');
    expect(dataRows[0]).toHaveTextContent('Compliant');
    expect(dataRows[0]).toHaveTextContent('4');
    expect(dataRows[0]).toHaveTextContent('0');
    expect(dataRows[1]).toHaveTextContent('BEARING-7');
    expect(dataRows[1]).toHaveTextContent('Non-compliant');
    expect(dataRows[1]).toHaveTextContent('2');
    expect(dataRows[1]).toHaveTextContent(/Agentic eligible/i);
  });

  it('renders em-dash for null manifest version and null predominant_resolution_class', () => {
    render(
      <SkuTable
        rows={[
          {
            product_id: 'p',
            sku_label: 'X',
            resolution_status: 'compliant',
            current_origin_manifest_version: null,
            unresolved_subtier_gap_count: 0,
            predominant_resolution_class: null,
            transformation_chain: null,
            lot_batch_lineage: null,
          },
        ]}
      />,
    );
    const dashes = screen.getAllByText('—');
    expect(dashes.length).toBeGreaterThanOrEqual(2);
  });

  it('renders empty-state copy when no rows', () => {
    render(<SkuTable rows={[]} />);
    expect(screen.getByText(/No SKUs in coverage/i)).toBeInTheDocument();
  });
});
