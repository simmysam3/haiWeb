import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const refresh = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh }),
}));

const fetchMock = vi.fn();
global.fetch = fetchMock as unknown as typeof fetch;

import { NominationDrawer } from '../nomination-drawer';
import type { InboundNominationRow } from '../_lib/types';

const row: InboundNominationRow = {
  obligation_id: 'obl-1',
  observer_participant_id: 'p-acme',
  observer_display_name: 'Acme',
  product_id: 'prod-1',
  sku_label: 'WIDGET-7',
  status: 'outstanding',
  arrival_time: '2026-04-28T10:00:00Z',
  resolution_class: 'pending',
  unresolved_subtier_count: 0,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('NominationDrawer', () => {
  it('renders obligation context from the row', () => {
    fetchMock.mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });
    render(<NominationDrawer row={row} onClose={() => {}} />);
    expect(screen.getByText(/Acme/)).toBeInTheDocument();
    expect(screen.getByText(/WIDGET-7/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /accept/i })).toBeInTheDocument();
  });

  it('POSTs acknowledge and triggers refresh on Accept', async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ status: 'acknowledged' }) });

    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<NominationDrawer row={row} onClose={onClose} />);
    await user.click(screen.getByRole('button', { name: /accept/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/account/sku-obligations/obl-1/acknowledge',
        expect.objectContaining({ method: 'POST' }),
      );
      expect(refresh).toHaveBeenCalled();
      expect(onClose).toHaveBeenCalled();
    });
  });

  it('shows inline error on 4xx and keeps drawer open', async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) })
      .mockResolvedValueOnce({
        ok: false,
        status: 409,
        json: () => Promise.resolve({ error: { code: 'OBLIGATION_ALREADY_TERMINAL', message: 'too late' } }),
      });

    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<NominationDrawer row={row} onClose={onClose} />);
    await user.click(screen.getByRole('button', { name: /accept/i }));

    expect(await screen.findByText(/already in a final state/i)).toBeInTheDocument();
    expect(refresh).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });
});
