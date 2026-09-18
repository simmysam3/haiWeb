import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock('@/lib/use-api', () => ({ useApi: vi.fn(() => ({ data: [], loading: false })) }));

// PF P13: the fixture carries trust_class because the UI must handle it; the as-built wire does not
// send it yet, so on a live console this component renders its "Raise to Premier" arm only.
const partner = {
  id: 'p-acme', company_name: 'Acme Metals', status: 'trading_pair' as const,
  established_at: '2026-08-01T00:00:00Z', location: 'Ohio', industry: 'Metals',
  invite_yours: true, invite_theirs: true, connection_id: 'conn-1', trust_class: 'trading_pair' as const,
};

describe('PartnersPanel premier designation', () => {
  it('shows "Raise to Premier" for a trading_pair partner and PUTs premier:true after confirm', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }));
    const { useApi } = await import('@/lib/use-api');
    (useApi as ReturnType<typeof vi.fn>).mockReturnValue({ data: [partner], loading: false });
    const { PartnersPanel } = await import('../partners-panel');
    render(<PartnersPanel />);
    fireEvent.click(screen.getByRole('tab', { name: /Active/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Raise to Premier' }));
    fireEvent.click(screen.getAllByRole('button', { name: 'Raise to Premier' })[1]);
    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith('/api/account/connections/conn-1/premier', expect.objectContaining({ method: 'PUT', body: JSON.stringify({ premier: true }) })));
  });

  it('shows no premier button for a partner at status "approved"', async () => {
    const { useApi } = await import('@/lib/use-api');
    (useApi as ReturnType<typeof vi.fn>).mockReturnValue({ data: [{ ...partner, status: 'approved' as const, trust_class: 'behavioral_only' as const }], loading: false });
    const { PartnersPanel } = await import('../partners-panel');
    render(<PartnersPanel />);
    fireEvent.click(screen.getByRole('tab', { name: /Active/ }));
    expect(screen.queryByRole('button', { name: /Premier/ })).not.toBeInTheDocument();
  });
});
