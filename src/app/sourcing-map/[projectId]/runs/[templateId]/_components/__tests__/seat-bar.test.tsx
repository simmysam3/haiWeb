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

  it('shows one segment per drop with its coverage in text and sets the as-of drop on click', () => {
    const onDrop = vi.fn();
    render(<SeatBar result={vomeroResult} unitLabel="pairs" asOfDrop="2027-03-15" onDrop={onDrop} productFilter={null} onProduct={vi.fn()} />);
    const strip = screen.getByRole('group', { name: 'Drops: choose the drop the map shows' });
    const buttons = within(strip).getAllByRole('button');
    expect(buttons.map((b) => b.textContent)).toEqual(['Jan 15 100%', 'Feb 15 100%', 'Mar 15 67%', 'Apr 15 83%', 'May 15 88%', 'Jun 15 90%']);
    expect(within(strip).getByRole('button', { name: 'Mar 15 67%' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(within(strip).getByRole('button', { name: 'Apr 15 83%' }));
    expect(onDrop).toHaveBeenCalledWith('2027-04-15');
  });

  it('groups 52 weekly drops into months; a month expands to its own drops (spec §9.3)', () => {
    const onDrop = vi.fn();
    render(<SeatBar result={weeklyDropsResult(52)} unitLabel="pairs" asOfDrop="2027-01-25" onDrop={onDrop} productFilter={null} onProduct={vi.fn()} />);
    const strip = screen.getByRole('group', { name: 'Drops: choose the drop the map shows' });
    const months = within(strip).getAllByRole('button');
    expect(months).toHaveLength(12);
    expect(months[0]!.textContent).toBe('Jan 2027 · 4 drops · lowest 81%');
    // Lane pre-empt: the month holding the as-of drop is pressed, and a month exposes whether it is expanded.
    expect(months[0]).toHaveAttribute('aria-pressed', 'true');
    const febMonth = within(strip).getByRole('button', { name: 'Feb 2027 · 4 drops · lowest 64%' });
    expect(febMonth).toHaveAttribute('aria-expanded', 'false');
    // House rule (haiWeb CLAUDE.md): an inline expander carries the DetailChevron, which turns down when open.
    expect(febMonth.querySelector('svg')).not.toHaveClass('rotate-90');
    fireEvent.click(febMonth);
    expect(febMonth).toHaveAttribute('aria-expanded', 'true');
    expect(febMonth.querySelector('svg')).toHaveClass('rotate-90');
    expect(onDrop).not.toHaveBeenCalled();
    const feb = screen.getByRole('group', { name: 'Drops in Feb 2027' });
    fireEvent.click(within(feb).getByRole('button', { name: 'Feb 8 100%' }));
    expect(onDrop).toHaveBeenCalledWith('2027-02-08');
  });

  it('counts a month that holds one drop as "1 drop" (controller ruling R2)', () => {
    render(<SeatBar result={weeklyDropsResult(14)} unitLabel="pairs" asOfDrop={null} onDrop={vi.fn()} productFilter={null} onProduct={vi.fn()} />);
    const strip = screen.getByRole('group', { name: 'Drops: choose the drop the map shows' });
    expect(within(strip).getAllByRole('button').map((b) => b.textContent)).toEqual([
      'Jan 2027 · 4 drops · lowest 81%', 'Feb 2027 · 4 drops · lowest 64%', 'Mar 2027 · 5 drops · lowest 81%', 'Apr 2027 · 1 drop · lowest 64%',
    ]);
  });
});
