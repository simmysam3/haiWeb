import '@testing-library/jest-dom/vitest';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ClassRollup } from '../class-rollup';
import { makeAggregateReport } from '../__fixtures__/aggregate-report';

describe('ClassRollup', () => {
  it('renders one row per class with master_label, root_label, component_count, and depth', () => {
    const rows = makeAggregateReport().class_rollup;
    render(<ClassRollup rows={rows} />);
    const dataRows = screen.getAllByRole('row').slice(1);
    expect(dataRows[0]).toHaveTextContent('Gaskets');
    expect(dataRows[0]).toHaveTextContent('Industrial Components');
    expect(dataRows[0]).toHaveTextContent('3');
    expect(dataRows[1]).toHaveTextContent('Bearings');
    expect(dataRows[1]).toHaveTextContent('Industrial Components');
    expect(dataRows[1]).toHaveTextContent('2');
  });

  it('renders sorted by component_count descending when rows are out of order', () => {
    const rows = [
      { node_id: 'a', master_label: 'Small', root_label: 'Root', component_count: 1, depth: 1 },
      { node_id: 'b', master_label: 'Big',   root_label: 'Root', component_count: 5, depth: 1 },
      { node_id: 'c', master_label: 'Mid',   root_label: 'Root', component_count: 3, depth: 1 },
    ];
    render(<ClassRollup rows={rows} />);
    const dataRows = screen.getAllByRole('row').slice(1);
    expect(dataRows[0]).toHaveTextContent('Big');
    expect(dataRows[1]).toHaveTextContent('Mid');
    expect(dataRows[2]).toHaveTextContent('Small');
  });

  it('renders an empty-state row when given no rows', () => {
    render(<ClassRollup rows={[]} />);
    expect(screen.getByText(/No class rollup data/i)).toBeInTheDocument();
  });
});
