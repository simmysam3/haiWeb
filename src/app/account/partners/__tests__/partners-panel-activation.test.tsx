import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock('@/lib/use-api', () => ({ useApi: vi.fn() }));

// Item 8 (final fix wave): a plain mock object has no `clone()`, so `describeApiError`'s
// `res.clone().json()` throws and it falls back to the generic per-status text — the refusal
// pins below then only prove a banner rendered, never that the server's reason reached it. A real
// Response (as partners-panel.test.tsx's own seven refusal tests already use) has `clone()`.
function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

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
    const fetchSpy = vi.fn().mockResolvedValue(jsonResponse({ error: 'Forbidden' }, 403));
    vi.stubGlobal('fetch', fetchSpy);
    const { useApi } = await import('@/lib/use-api');
    (useApi as ReturnType<typeof vi.fn>).mockReturnValue({ data: [pendingPartner], loading: false });
    const { PartnersPanel } = await import('../partners-panel');
    render(<PartnersPanel />);
    fireEvent.click(screen.getByRole('tab', { name: /Active/ }));

    fireEvent.click(screen.getByRole('button', { name: 'Accept Trading Pair' }));

    // Item 8: a real Response lets describeApiError read the server's actual reason.
    expect(await screen.findByRole('alert')).toHaveTextContent('Forbidden');
    expect(screen.queryByText(/activated trading pair with/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Accept Trading Pair' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Decline' })).toBeInTheDocument();
  });

  // I3 (Batch 2 fix round): every other row gesture (Propose/Withdraw, Premier,
  // Downgrade, Remove, Block) confirms through a modal before posting; Decline
  // clears both sides' invites and must not be the exception.
  it('a click on Decline alone sends no POST; confirming sends one', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(jsonResponse({
      connection_id: 'conn-1', relationship_state: 'approved',
      invite_status: { requestor_invite: false, counterparty_invite: false },
    }));
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
    const fetchSpy = vi.fn().mockResolvedValue(jsonResponse({ error: 'Forbidden' }, 403));
    vi.stubGlobal('fetch', fetchSpy);
    const { useApi } = await import('@/lib/use-api');
    (useApi as ReturnType<typeof vi.fn>).mockReturnValue({ data: [pendingPartner], loading: false });
    const { PartnersPanel } = await import('../partners-panel');
    render(<PartnersPanel />);
    fireEvent.click(screen.getByRole('tab', { name: /Active/ }));

    fireEvent.click(screen.getByRole('button', { name: 'Decline' }));
    const confirm = (await screen.findAllByRole('button', { name: 'Decline' })).at(-1)!;
    fireEvent.click(confirm);

    // Item 8: a real Response lets describeApiError read the server's actual reason.
    expect(await screen.findByRole('alert')).toHaveTextContent('Forbidden');
    expect(screen.queryByText(/declined trading pair activation with/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Accept Trading Pair' })).toBeInTheDocument();
  });

  // Item 13 (final fix wave): handleDeclineActivation hardcoded
  // `{ invite_yours: false, invite_theirs: false }` instead of reading the decline response's
  // invite_status (PF P22: { connection_id, relationship_state, invite_status: { requestor_invite,
  // counterparty_invite } }). haiCore's as-built type pins both to false today, but the console
  // must not assume that — it should show whatever the server actually returns.
  //
  // The fixture starts both invites FALSE (unlike `pendingPartner`, which starts both true) so a
  // regression to the hardcoded `false, false` produces NO visible change at all — the same state
  // the row already had before the click — and this assertion can only pass by the response
  // actually being read and applied, never by a race against the pre-click DOM.
  it('applies the invite_status the decline response returns, not a hardcoded pair', async () => {
    const partnerWithNoInvites = { ...pendingPartner, invite_yours: false, invite_theirs: false };
    const fetchSpy = vi.fn().mockResolvedValue(jsonResponse({
      connection_id: 'conn-1', relationship_state: 'approved',
      invite_status: { requestor_invite: true, counterparty_invite: true },
    }));
    vi.stubGlobal('fetch', fetchSpy);
    const { useApi } = await import('@/lib/use-api');
    (useApi as ReturnType<typeof vi.fn>).mockReturnValue({ data: [partnerWithNoInvites], loading: false });
    const { PartnersPanel } = await import('../partners-panel');
    render(<PartnersPanel />);
    fireEvent.click(screen.getByRole('tab', { name: /Active/ }));
    expect(screen.getByText('Your Invite: Not Sent')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Decline' }));
    const confirm = (await screen.findAllByRole('button', { name: 'Decline' })).at(-1)!;
    fireEvent.click(confirm);

    await waitFor(() => expect(screen.getByText('Your Invite: Sent')).toBeInTheDocument());
    expect(screen.getByText('Their Invite: Received')).toBeInTheDocument();
  });
});
