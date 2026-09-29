import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { vomeroResult, resultWithAgentFailure, weeklyDropsResult, zeroSlotResult, VOMERO_IDS } from '@/lib/sourcing-map/__fixtures__/vomero';
import { SeatBar } from '../seat-bar';

describe('SeatBar', () => {
  it('shows the portfolio demand as its one figure: the drops carry the coverage, so no separate call-out repeats it (owner, walk 2026-09-29)', () => {
    render(<SeatBar result={vomeroResult} unitLabel="pairs" asOfDrop="2027-03-15" onDrop={vi.fn()} productFilter={null} onProduct={vi.fn()} />);
    expect(screen.getByText('96,000 pairs · 6 drops')).toBeInTheDocument();
    expect(screen.queryByText('Covered by the last drop')).toBeNull();
    expect(screen.queryByText('First short drop')).toBeNull();
    expect(screen.getAllByRole('term').map((t) => t.textContent)).toEqual(['Portfolio demand']);
  });

  it('puts the drops on the line of the portfolio demand they belong to, and the product filter underneath (owner, walk 2026-09-29)', () => {
    render(<SeatBar result={vomeroResult} unitLabel="pairs" asOfDrop="2027-03-15" onDrop={vi.fn()} productFilter={null} onProduct={vi.fn()} />);
    const timeline = screen.getByTestId('sm-seat-timeline');
    expect(timeline.className).toContain('flex');
    expect(within(timeline).getByText('Portfolio demand')).toBeInTheDocument();
    expect(within(timeline).getByText('96,000 pairs · 6 drops')).toBeInTheDocument();
    expect(within(timeline).getByRole('group', { name: 'Drops: choose the drop the map shows' })).toBeInTheDocument();
    const filter = screen.getByRole('group', { name: 'Filter by product' });
    expect(timeline.contains(filter)).toBe(false);
    expect(timeline.compareDocumentPosition(filter) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('reads honestly for a zero-slot execution: no NaN or Infinity, and each failed product says why (Review Focus 5)', () => {
    const { container } = render(<SeatBar result={zeroSlotResult()} unitLabel="pairs" asOfDrop={null} onDrop={vi.fn()} productFilter={null} onProduct={vi.fn()} />);
    expect(screen.getByText('No composed demand')).toBeInTheDocument();
    const chips = within(screen.getByRole('group', { name: 'Filter by product' })).getAllByRole('button').slice(1);
    expect(chips.map((b) => b.textContent)).toEqual(['Pegasus Trail', 'Court Classic', 'Metcon Iron'].map((n) => `${n} · BOM unavailable from agent`));
    expect(within(screen.getByRole('group', { name: 'Drops: choose the drop the map shows' })).queryAllByRole('button')).toHaveLength(0);
    expect(container.textContent).not.toMatch(/NaN|Infinity|undefined/);
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
    expect(buttons.map((b) => b.textContent)).toEqual(['Jan 15 100%', 'Feb 15 100%', 'Mar 15 67% · first short', 'Apr 15 83%', 'May 15 88%', 'Jun 15 90%']);
    expect(within(strip).getByRole('button', { name: 'Mar 15 67% · first short' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(within(strip).getByRole('button', { name: 'Apr 15 83%' }));
    expect(onDrop).toHaveBeenCalledWith('2027-04-15');
  });

  it('names the product row as a filter in words a sighted user can read, and the group takes its name from them (owner, walk 2026-09-29)', () => {
    render(<SeatBar result={vomeroResult} unitLabel="pairs" asOfDrop="2027-03-15" onDrop={vi.fn()} productFilter={null} onProduct={vi.fn()} />);
    const label = screen.getByText('Filter by product');
    const filter = screen.getByRole('group', { name: 'Filter by product' });
    expect(filter.contains(label)).toBe(true);
    expect(filter.getAttribute('aria-labelledby')).toBe(label.id);
    expect(within(filter).getAllByRole('button')[0]).toHaveTextContent('All products');
  });

  it('marks the first short drop on the timeline itself, in words, and no other drop (owner, walk 2026-09-29)', () => {
    const { unmount } = render(<SeatBar result={vomeroResult} unitLabel="pairs" asOfDrop="2027-01-15" onDrop={vi.fn()} productFilter={null} onProduct={vi.fn()} />);
    const strip = screen.getByRole('group', { name: 'Drops: choose the drop the map shows' });
    expect(within(strip).getAllByRole('button').map((b) => b.textContent)).toEqual([
      'Jan 15 100%', 'Feb 15 100%', 'Mar 15 67% · first short', 'Apr 15 83%', 'May 15 88%', 'Jun 15 90%',
    ]);
    unmount();
    // By month: the month that holds it names the drop, and the drop says so once the month is open.
    render(<SeatBar result={weeklyDropsResult(52)} unitLabel="pairs" asOfDrop={null} onDrop={vi.fn()} productFilter={null} onProduct={vi.fn()} />);
    const months = screen.getByRole('group', { name: 'Drops: choose the drop the map shows' });
    const jan = within(months).getByRole('button', { name: 'Jan 2027 · 4 drops · lowest 81% · first short Jan 25' });
    expect(within(months).getAllByRole('button').filter((b) => /first short/.test(b.textContent ?? ''))).toEqual([jan]);
    fireEvent.click(jan);
    expect(within(screen.getByRole('group', { name: 'Drops in Jan 2027' })).getAllByRole('button').map((b) => b.textContent)).toEqual([
      'Jan 4 100%', 'Jan 11 100%', 'Jan 18 100%', 'Jan 25 81% · first short',
    ]);
  });

  it('groups 52 weekly drops into months; a month expands to its own drops (spec §9.3)', () => {
    const onDrop = vi.fn();
    render(<SeatBar result={weeklyDropsResult(52)} unitLabel="pairs" asOfDrop="2027-01-25" onDrop={onDrop} productFilter={null} onProduct={vi.fn()} />);
    const strip = screen.getByRole('group', { name: 'Drops: choose the drop the map shows' });
    const months = within(strip).getAllByRole('button');
    expect(months).toHaveLength(12);
    expect(months[0]!.textContent).toBe('Jan 2027 · 4 drops · lowest 81% · first short Jan 25');
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

  it('shows one segment per drop up to 12 drops and months from 13 (spec §9.3; fix round 1, M2)', () => {
    const props = { unitLabel: 'pairs', asOfDrop: null, onDrop: vi.fn(), productFilter: null, onProduct: vi.fn() };
    const { unmount } = render(<SeatBar result={weeklyDropsResult(12)} {...props} />);
    const twelve = within(screen.getByRole('group', { name: 'Drops: choose the drop the map shows' })).getAllByRole('button');
    expect(twelve).toHaveLength(12);
    expect(twelve[0]!.textContent).toBe('Jan 4 100%');
    expect(twelve.filter((b) => b.hasAttribute('aria-expanded'))).toHaveLength(0);
    unmount();
    render(<SeatBar result={weeklyDropsResult(13)} {...props} />);
    const thirteen = within(screen.getByRole('group', { name: 'Drops: choose the drop the map shows' })).getAllByRole('button');
    expect(thirteen.map((b) => b.textContent)).toEqual(['Jan 2027 · 4 drops · lowest 81% · first short Jan 25', 'Feb 2027 · 4 drops · lowest 64%', 'Mar 2027 · 5 drops · lowest 81%']);
    expect(thirteen.every((b) => b.getAttribute('aria-expanded') === 'false')).toBe(true);
  });

  it('counts a month that holds one drop as "1 drop" (controller ruling R2)', () => {
    render(<SeatBar result={weeklyDropsResult(14)} unitLabel="pairs" asOfDrop={null} onDrop={vi.fn()} productFilter={null} onProduct={vi.fn()} />);
    const strip = screen.getByRole('group', { name: 'Drops: choose the drop the map shows' });
    expect(within(strip).getAllByRole('button').map((b) => b.textContent)).toEqual([
      'Jan 2027 · 4 drops · lowest 81% · first short Jan 25', 'Feb 2027 · 4 drops · lowest 64%', 'Mar 2027 · 5 drops · lowest 81%', 'Apr 2027 · 1 drop · lowest 64%',
    ]);
  });

  it('shows nothing for an open month that is gone after the drops change, and never throws (lane pre-empt: state between targets)', () => {
    const r = weeklyDropsResult(52);
    const props = { unitLabel: 'pairs', asOfDrop: null, onDrop: vi.fn(), productFilter: null, onProduct: vi.fn() };
    const { rerender } = render(<SeatBar result={r} {...props} />);
    const strip = screen.getByRole('group', { name: 'Drops: choose the drop the map shows' });
    fireEvent.click(within(strip).getByRole('button', { name: 'Feb 2027 · 4 drops · lowest 64%' }));
    expect(screen.getByRole('group', { name: 'Drops in Feb 2027' })).toBeInTheDocument();
    const withoutFeb = { ...r, portfolio: { ...r.portfolio, drops: r.portfolio.drops.filter((d) => !d.due_date.startsWith('2027-02')) } };
    rerender(<SeatBar result={withoutFeb} {...props} />);
    expect(within(strip).getAllByRole('button')).toHaveLength(11);
    expect(screen.queryByRole('group', { name: /^Drops in / })).toBeNull();
    expect(within(strip).getAllByRole('button').filter((b) => b.getAttribute('aria-expanded') === 'true')).toHaveLength(0);
  });
});
