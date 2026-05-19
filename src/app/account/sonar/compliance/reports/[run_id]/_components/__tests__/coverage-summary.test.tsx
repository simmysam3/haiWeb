import '@testing-library/jest-dom/vitest';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CoverageSummary } from '../coverage-summary';
import { makePerVendorReport } from '../__fixtures__/per-vendor-report';

describe('CoverageSummary', () => {
  it('renders the four SKU counts', () => {
    const summary = makePerVendorReport().coverage_summary;
    render(<CoverageSummary summary={summary} />);
    expect(screen.getByText('Total SKUs').nextSibling).toHaveTextContent('3');
    expect(screen.getByText('Compliant').nextSibling).toHaveTextContent('2');
    expect(screen.getByText('Partially compliant').nextSibling).toHaveTextContent('0');
    expect(screen.getByText('Non-compliant').nextSibling).toHaveTextContent('1');
  });
});
