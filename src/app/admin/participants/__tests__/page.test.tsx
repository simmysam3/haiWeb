import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

/**
 * v1.75 walk W7: /admin/participants was 100% mock theater —
 * useState(MOCK_ADMIN_PARTICIPANTS), suspend/reactivate flipped client state
 * and never called an API (the owner "suspended" Lyn-Tron on it; the DB never
 * changed). These tests pin the real surface: rows from GET
 * /api/admin/participants, actions through POST /api/admin/actions, and API
 * failure surfacing as absence + an error notice — never as mock rows.
 */

const LIST = {
  participants: [
    {
      participant_id: '11111111-1111-4111-8111-111111111111',
      legal_name: 'Precision Plastics LLC',
      status: 'active',
      business_address_city: 'Toledo',
      business_address_state: 'OH',
      business_address_country: 'US',
      registered_at: '2026-07-01T00:00:00.000Z',
      suspension_reason: null,
      agent_count: 2,
      trading_pair_count: 3,
    },
    {
      participant_id: '22222222-2222-4222-8222-222222222222',
      legal_name: 'Great Lakes Brass',
      status: 'suspended',
      business_address_city: null,
      business_address_state: null,
      business_address_country: null,
      registered_at: '2026-06-15T00:00:00.000Z',
      suspension_reason: 'payment fraud investigation',
      agent_count: 1,
      trading_pair_count: 1,
    },
  ],
  total_count: 2,
};

const { mockUseApi, refetch } = vi.hoisted(() => ({
  mockUseApi: vi.fn(),
  refetch: vi.fn(),
}));

vi.mock('@/lib/use-api', () => ({ useApi: mockUseApi }));

import ParticipantsPage from '../page';

describe('/admin/participants on the real list API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseApi.mockReturnValue({ data: LIST, loading: false, error: null, refetch });
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 })),
    );
  });

  it('renders rows from the API payload, not from any mock', () => {
    render(<ParticipantsPage />);
    expect(mockUseApi).toHaveBeenCalledWith(
      expect.objectContaining({ url: '/api/admin/participants' }),
    );
    expect(screen.getByText('Precision Plastics LLC')).toBeInTheDocument();
    expect(screen.getByText('Great Lakes Brass')).toBeInTheDocument();
    expect(screen.getByText(/2 participants/)).toBeInTheDocument();
  });

  it('suspending POSTs the real admin action with the typed justification, then refetches', async () => {
    const user = userEvent.setup();
    render(<ParticipantsPage />);

    const row = screen.getByText('Precision Plastics LLC').closest('tr')!;
    await user.click(within(row).getByRole('button', { name: /suspend/i }));
    const dialog = screen.getByRole('dialog');
    await user.type(within(dialog).getByPlaceholderText(/reason/i), 'contract breach');
    await user.click(within(dialog).getByRole('button', { name: /^suspend$/i }));

    const calls = (fetch as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls.length).toBe(1);
    const [calledUrl, init] = calls[0] as [string, RequestInit];
    expect(calledUrl).toBe('/api/admin/actions');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({
      action: 'suspend',
      participant_id: '11111111-1111-4111-8111-111111111111',
      justification: 'contract breach',
    });
    await waitFor(() => expect(refetch).toHaveBeenCalled());
  });

  it('reactivating also collects a justification (the audit log requires one) and POSTs it', async () => {
    const user = userEvent.setup();
    render(<ParticipantsPage />);

    const row = screen.getByText('Great Lakes Brass').closest('tr')!;
    await user.click(within(row).getByRole('button', { name: /reactivate/i }));
    const dialog = screen.getByRole('dialog');
    await user.type(within(dialog).getByPlaceholderText(/reason/i), 'investigation cleared');
    await user.click(within(dialog).getByRole('button', { name: /^reactivate$/i }));

    const [calledUrl, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    expect(calledUrl).toBe('/api/admin/actions');
    expect(JSON.parse(init.body as string)).toEqual({
      action: 'reactivate',
      participant_id: '22222222-2222-4222-8222-222222222222',
      justification: 'investigation cleared',
    });
    await waitFor(() => expect(refetch).toHaveBeenCalled());
  });

  it('a failed action surfaces the failure and does NOT flip any row state locally', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 503 })));
    const user = userEvent.setup();
    render(<ParticipantsPage />);

    const row = screen.getByText('Precision Plastics LLC').closest('tr')!;
    await user.click(within(row).getByRole('button', { name: /suspend/i }));
    const dialog = screen.getByRole('dialog');
    await user.type(within(dialog).getByPlaceholderText(/reason/i), 'contract breach');
    await user.click(within(dialog).getByRole('button', { name: /^suspend$/i }));

    expect(await screen.findByText(/failed/i)).toBeInTheDocument();
    expect(refetch).not.toHaveBeenCalled();
  });

  it('API failure surfaces as absence + an error notice — never mock rows', () => {
    mockUseApi.mockReturnValue({ data: null, loading: false, error: '503', refetch });
    render(<ParticipantsPage />);
    expect(screen.getByText(/couldn't load participants/i)).toBeInTheDocument();
    expect(screen.queryByText('Precision Plastics LLC')).toBeNull();
    // The old mock's residents must never appear.
    expect(screen.queryByText(/Lyn-Tron/)).toBeNull();
  });
});
