import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock('@/lib/use-api', () => ({ useApi: vi.fn(() => ({ data: [], loading: false })) }));

// Item 8 (final fix wave): a plain mock object has no `clone()`, so `describeApiError`'s
// `res.clone().json()` throws and falls back to the generic per-status text, so the refusal pin
// below only proved a banner rendered, never that the server's reason reached it.
function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

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
    // Item 9: a present control — the row itself must render, so the negative assertion below
    // proves the button is absent from a real row, not from an empty/failed render.
    expect(screen.getByText('Acme Metals')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Premier/ })).not.toBeInTheDocument();
  });

  // I2 (Batch 2 fix round): matches the panel's own "a 403 ... shows the
  // error" bar (partners-panel.test.tsx) — no new refusal test existed for
  // this gesture.
  it('a 403 leaves the trust class unchanged, shows no success toast, and shows the error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ error: 'Forbidden' }, 403)));
    const { useApi } = await import('@/lib/use-api');
    (useApi as ReturnType<typeof vi.fn>).mockReturnValue({ data: [partner], loading: false });
    const { PartnersPanel } = await import('../partners-panel');
    render(<PartnersPanel />);
    fireEvent.click(screen.getByRole('tab', { name: /Active/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Raise to Premier' }));
    fireEvent.click(screen.getAllByRole('button', { name: 'Raise to Premier' })[1]);

    // Item 8: a real Response lets describeApiError read the server's actual reason.
    expect(await screen.findByRole('alert')).toHaveTextContent('Forbidden');
    expect(screen.queryByText(/raised .* to premier/i)).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Raise to Premier' })[0]).toBeInTheDocument();
  });
});
