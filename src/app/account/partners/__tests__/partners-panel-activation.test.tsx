import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock('@/lib/use-api', () => ({ useApi: vi.fn() }));

// PF P13: the fixture carries pending_activation_at because the UI must handle it; the as-built
// wire does not send it yet, so on a live console this branch does not render at all.
const pendingPartner = {
  id: 'p-acme', company_name: 'Acme Metals', status: 'approved' as const,
  established_at: '2026-08-01T00:00:00Z', location: 'Ohio', industry: 'Metals',
  invite_yours: true, invite_theirs: true, connection_id: 'conn-1', pending_activation_at: '2026-09-16T00:00:00Z',
};

describe('PartnersPanel D-146 activation', () => {
  it('shows Accept/Decline instead of Withdraw/Propose when pending_activation_at is set', async () => {
    const { useApi } = await import('@/lib/use-api');
    (useApi as ReturnType<typeof vi.fn>).mockReturnValue({ data: [pendingPartner], loading: false });
    const { PartnersPanel } = await import('../partners-panel');
    render(<PartnersPanel />);
    fireEvent.click(screen.getByRole('tab', { name: /Active/ }));
    expect(screen.getByRole('button', { name: 'Accept Trading Pair' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Decline' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Withdraw Trading Pair/ })).not.toBeInTheDocument();
  });

  it('POSTs to activate on Accept', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ relationship_state: 'trading_pair' }) }));
    const { useApi } = await import('@/lib/use-api');
    (useApi as ReturnType<typeof vi.fn>).mockReturnValue({ data: [pendingPartner], loading: false });
    const { PartnersPanel } = await import('../partners-panel');
    render(<PartnersPanel />);
    fireEvent.click(screen.getByRole('tab', { name: /Active/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Accept Trading Pair' }));
    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith('/api/account/connections/conn-1/activate', expect.objectContaining({ method: 'POST' })));
  });

  // I2 (Batch 2 fix round): matches the panel's own "a 403 ... shows the
  // error" bar (partners-panel.test.tsx) — no new refusal test existed for
  // this gesture.
  it('a 403 on Accept leaves the pending row unchanged, shows no success toast, and shows the error', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({ ok: false, status: 403, json: async () => ({ error: 'Forbidden' }) });
    vi.stubGlobal('fetch', fetchSpy);
    const { useApi } = await import('@/lib/use-api');
    (useApi as ReturnType<typeof vi.fn>).mockReturnValue({ data: [pendingPartner], loading: false });
    const { PartnersPanel } = await import('../partners-panel');
    render(<PartnersPanel />);
    fireEvent.click(screen.getByRole('tab', { name: /Active/ }));

    fireEvent.click(screen.getByRole('button', { name: 'Accept Trading Pair' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/forbidden|permission/i);
    expect(screen.queryByText(/activated trading pair with/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Accept Trading Pair' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Decline' })).toBeInTheDocument();
  });

  // I3 (Batch 2 fix round): every other row gesture (Propose/Withdraw, Premier,
  // Downgrade, Remove, Block) confirms through a modal before posting; Decline
  // clears both sides' invites and must not be the exception.
  it('a click on Decline alone sends no POST; confirming sends one', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    vi.stubGlobal('fetch', fetchSpy);
    const { useApi } = await import('@/lib/use-api');
    (useApi as ReturnType<typeof vi.fn>).mockReturnValue({ data: [pendingPartner], loading: false });
    const { PartnersPanel } = await import('../partners-panel');
    render(<PartnersPanel />);
    fireEvent.click(screen.getByRole('tab', { name: /Active/ }));

    fireEvent.click(screen.getByRole('button', { name: 'Decline' }));
    expect(fetchSpy).not.toHaveBeenCalled();

    const confirm = (await screen.findAllByRole('button', { name: 'Decline' })).at(-1)!;
    fireEvent.click(confirm);
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledWith('/api/account/connections/conn-1/decline-activation', expect.objectContaining({ method: 'POST' })));
  });

  // I2 (Batch 2 fix round): matches the panel's own "a 403 ... shows the
  // error" bar (partners-panel.test.tsx) — no new refusal test existed for
  // this gesture.
  it('a 403 on Decline leaves the pending row unchanged, shows no success toast, and shows the error', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({ ok: false, status: 403, json: async () => ({ error: 'Forbidden' }) });
    vi.stubGlobal('fetch', fetchSpy);
    const { useApi } = await import('@/lib/use-api');
    (useApi as ReturnType<typeof vi.fn>).mockReturnValue({ data: [pendingPartner], loading: false });
    const { PartnersPanel } = await import('../partners-panel');
    render(<PartnersPanel />);
    fireEvent.click(screen.getByRole('tab', { name: /Active/ }));

    fireEvent.click(screen.getByRole('button', { name: 'Decline' }));
    const confirm = (await screen.findAllByRole('button', { name: 'Decline' })).at(-1)!;
    fireEvent.click(confirm);

    expect(await screen.findByRole('alert')).toHaveTextContent(/forbidden|permission/i);
    expect(screen.queryByText(/declined trading pair activation with/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Accept Trading Pair' })).toBeInTheDocument();
  });
});
