import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { vomeroResult, resultWithAgentFailure, weeklyDropsResult, VOMERO_IDS } from '@/lib/sourcing-map/__fixtures__/vomero';
import { SeatBar } from '../seat-bar';

describe('SeatBar', () => {
  it('shows portfolio demand, coverage by the last drop and the first short drop', () => {
    render(<SeatBar result={vomeroResult} unitLabel="pairs" asOfDrop="2027-03-15" onDrop={vi.fn()} productFilter={null} onProduct={vi.fn()} />);
    expect(screen.getByText('96,000 pairs · 6 drops')).toBeInTheDocument();
    expect(screen.getByText('90%')).toBeInTheDocument();
    expect(screen.getByText('Mar 15')).toBeInTheDocument();
  });

  it('offers All products plus a chip per product with its coverage; a failed product reads "BOM unavailable from agent"', () => {
    const onProduct = vi.fn();
    const { rerender } = render(<SeatBar result={resultWithAgentFailure()} unitLabel="pairs" asOfDrop={null} onDrop={vi.fn()} productFilter={null} onProduct={onProduct} />);
    const strip = screen.getByRole('group', { name: 'Filter by product' });
    expect(within(strip).getByRole('button', { name: 'All products' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(within(strip).getByRole('button', { name: 'Pegasus Trail 95%' }));
    expect(onProduct).toHaveBeenCalledWith(VOMERO_IDS.pegasus);
    expect(within(strip).getByRole('button', { name: 'Metcon Iron · BOM unavailable from agent' })).toBeInTheDocument();
    // Lane pre-empt: the selected product's chip exposes its pressed state, and "All products" lets go of it.
    rerender(<SeatBar result={resultWithAgentFailure()} unitLabel="pairs" asOfDrop={null} onDrop={vi.fn()} productFilter={VOMERO_IDS.pegasus} onProduct={onProduct} />);
    expect(within(strip).getByRole('button', { name: 'Pegasus Trail 95%' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(strip).getByRole('button', { name: 'All products' })).toHaveAttribute('aria-pressed', 'false');
  });
});
