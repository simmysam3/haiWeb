import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PhantomDemandScopeFields } from '../phantom-demand-scope-fields';

const fetchMock = vi.fn();
beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockResolvedValue(
    new Response(
      JSON.stringify([
        { id: 'cp-1', company_name: 'Great Lakes Hardware', status: 'trading_pair' },
      ]),
      { status: 200 },
    ),
  );
});

const BASE = {
  kind: 'phantom_demand' as const,
  authorization_basis: 'bilateral' as const,
  counterparty: '',
  skus: [] as string[],
  hypothetical_quantity: 1,
  hypothetical_timeline: null as string | null,
};

describe('PhantomDemandScopeFields', () => {
  it('renders the relabeled "Target Delivery Date" and not "Hypothetical Timeline"', () => {
    render(<PhantomDemandScopeFields value={BASE} onChange={vi.fn()} />);
    expect(screen.getByText(/target delivery date/i)).toBeInTheDocument();
    expect(screen.queryByText(/hypothetical timeline/i)).not.toBeInTheDocument();
  });

  it('emits quantity changes preserving scope shape', async () => {
    const onChange = vi.fn();
    render(<PhantomDemandScopeFields value={BASE} onChange={onChange} />);
    const qty = screen.getByLabelText(/hypothetical quantity/i);
    await userEvent.clear(qty);
    await userEvent.type(qty, '250');
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ kind: 'phantom_demand', hypothetical_quantity: 250 }),
    );
  });

  it('selecting a counterparty resets skus (D9)', async () => {
    const onChange = vi.fn();
    render(
      <PhantomDemandScopeFields
        value={{ ...BASE, skus: ['STALE-1'] }}
        onChange={onChange}
      />,
    );
    await userEvent.click(await screen.findByText('Great Lakes Hardware'));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ counterparty: 'cp-1', skus: [] }),
    );
  });
});
