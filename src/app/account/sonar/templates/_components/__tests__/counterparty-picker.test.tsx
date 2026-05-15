import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CounterpartyPicker } from '../counterparty-picker';

const fetchMock = vi.fn();
beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

const PARTNERS = [
  { id: 'p-tp-1', company_name: 'Great Lakes Hardware', status: 'trading_pair', industry: 'Hardware', location: 'Detroit, MI' },
  { id: 'p-ap-1', company_name: 'Approved Only Co', status: 'approved', industry: 'Misc', location: 'Reno, NV' },
  { id: 'p-tp-2', company_name: 'MidWest Fastener', status: 'trading_pair', industry: 'Fasteners', location: 'Chicago, IL' },
];

function resolvePartners() {
  fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(PARTNERS), { status: 200 }));
}

describe('CounterpartyPicker', () => {
  it('lists only trading_pair partners and excludes approved', async () => {
    resolvePartners();
    render(<CounterpartyPicker value="" onChange={vi.fn()} />);
    expect(await screen.findByText('Great Lakes Hardware')).toBeInTheDocument();
    expect(screen.getByText('MidWest Fastener')).toBeInTheDocument();
    expect(screen.queryByText('Approved Only Co')).not.toBeInTheDocument();
  });

  it('filters by company name via the search box', async () => {
    resolvePartners();
    render(<CounterpartyPicker value="" onChange={vi.fn()} />);
    await screen.findByText('Great Lakes Hardware');
    await userEvent.type(screen.getByPlaceholderText(/search trading partners/i), 'midwest');
    expect(screen.queryByText('Great Lakes Hardware')).not.toBeInTheDocument();
    expect(screen.getByText('MidWest Fastener')).toBeInTheDocument();
  });

  it('emits the participant id on selection (single select)', async () => {
    resolvePartners();
    const onChange = vi.fn();
    render(<CounterpartyPicker value="" onChange={onChange} />);
    await userEvent.click(await screen.findByText('MidWest Fastener'));
    expect(onChange).toHaveBeenCalledWith('p-tp-2');
  });

  it('shows an explanatory empty state when no trading pairs exist', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify([{ id: 'x', company_name: 'A', status: 'approved' }]), { status: 200 }),
    );
    render(<CounterpartyPicker value="" onChange={vi.fn()} />);
    expect(await screen.findByText(/no trading pairs/i)).toBeInTheDocument();
  });
});
