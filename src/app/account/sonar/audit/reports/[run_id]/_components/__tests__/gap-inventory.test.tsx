import '@testing-library/jest-dom/vitest';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { GapInventory } from '../gap-inventory';
import { makeAggregateReport } from '../__fixtures__/aggregate-report';

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
});
