import '@testing-library/jest-dom/vitest';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { GeographicRollup } from '../geographic-rollup';
import { makeAggregateReport } from '../__fixtures__/aggregate-report';

describe('GeographicRollup', () => {
  it('renders rows sorted by component_count desc with country labels and counts', () => {
    const rows = makeAggregateReport().geographic_rollup;
    render(<GeographicRollup rows={rows} />);
    const dataRows = screen.getAllByRole('row').slice(1);
    expect(dataRows[0]).toHaveTextContent('United States');
    expect(dataRows[0]).toHaveTextContent('4');
    expect(dataRows[1]).toHaveTextContent('Germany');
    expect(dataRows[1]).toHaveTextContent('1');
  });

  it('renders an empty-state row when given no rows', () => {
    render(<GeographicRollup rows={[]} />);
    expect(screen.getByText(/No geographic data/i)).toBeInTheDocument();
  });
});
