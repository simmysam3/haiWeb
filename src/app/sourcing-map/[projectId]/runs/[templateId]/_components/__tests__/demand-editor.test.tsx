import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { vomeroProducts, vomeroRunTemplate } from '@/lib/sourcing-map/__fixtures__/vomero';
import { DemandEditor } from '../demand-editor';

vi.mock('recharts', async () => {
  const actual = await vi.importActual<typeof import('recharts')>('recharts');
  return { ...actual, ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div data-testid="recharts-responsive">{children}</div> };
});

describe('DemandEditor', () => {
  it('generates ramp drops with an exact total, charts them accessibly, and edits and overrides a drop', () => {
    const onChange = vi.fn();
    const demand = vomeroRunTemplate.scope.products[0]!.demand;
    const { rerender } = render(<DemandEditor product={vomeroProducts[0]!} demand={demand} onChange={onChange} />);
    expect(screen.getByRole('figure', { name: '6 drops totalling 36,000 pairs' })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Shape for Pegasus Trail'), { target: { value: 'ramp' } });
    fireEvent.change(screen.getByLabelText('Total for Pegasus Trail'), { target: { value: '21' } });
    fireEvent.click(screen.getByRole('button', { name: 'Generate drops for Pegasus Trail' }));
    const generated = onChange.mock.lastCall![0];
    expect(generated.drops.map((d: { qty: number }) => d.qty)).toEqual([2, 2, 3, 4, 5, 5]);
    expect(generated.generator).toMatchObject({ total: 21, shape: 'ramp', count: 6, spacing: 'monthly' });
    rerender(<DemandEditor product={vomeroProducts[0]!} demand={demand} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('Quantity of drop 2 for Pegasus Trail'), { target: { value: '6500' } });
    expect(onChange.mock.lastCall![0].drops[1].qty).toBe(6500);
    fireEvent.click(screen.getByLabelText('Override the mix for drop 3 of Pegasus Trail'));
    expect(onChange.mock.lastCall![0].drops[2].mix_override).toEqual(demand.mix);
  });

  it('flags drops that are out of date order or repeat a date (spec §7.4)', () => {
    const demand = vomeroRunTemplate.scope.products[0]!.demand;
    const [first, second, ...rest] = demand.drops;
    const { rerender } = render(<DemandEditor product={vomeroProducts[0]!} demand={demand} onChange={vi.fn()} />);
    expect(screen.queryByRole('alert')).toBeNull();
    rerender(<DemandEditor product={vomeroProducts[0]!} demand={{ ...demand, drops: [second!, first!, ...rest] }} onChange={vi.fn()} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Drops must be in date order, with no date repeated.');
    rerender(<DemandEditor product={vomeroProducts[0]!} demand={{ ...demand, drops: [first!, { ...second!, due_date: first!.due_date }, ...rest] }} onChange={vi.fn()} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Drops must be in date order, with no date repeated.');
  });
});
