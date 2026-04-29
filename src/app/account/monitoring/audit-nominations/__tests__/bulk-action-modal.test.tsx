import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const refresh = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));

const fetchMock = vi.fn();
global.fetch = fetchMock as unknown as typeof fetch;

import { BulkActionModal } from '../bulk-action-modal';

const observers = [
  { obligation_id: 'a', display_name: 'Acme' },
  { obligation_id: 'b', display_name: 'Globex' },
  { obligation_id: 'c', display_name: 'Initech' },
];

beforeEach(() => {
  vi.clearAllMocks();
});

describe('BulkActionModal', () => {
  it('lists observers and posts N parallel acknowledge requests on confirm', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });
    const user = userEvent.setup();
    render(
      <BulkActionModal
        action="acknowledge"
        sku_label="WIDGET-7"
        observers={observers}
        onClose={() => {}}
      />,
    );
    expect(screen.getByText('Acme')).toBeInTheDocument();
    expect(screen.getByText('Globex')).toBeInTheDocument();
    expect(screen.getByText('Initech')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /confirm/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(3);
      expect(fetchMock.mock.calls.map((c) => c[0]).sort()).toEqual([
        '/api/account/sku-obligations/a/acknowledge',
        '/api/account/sku-obligations/b/acknowledge',
        '/api/account/sku-obligations/c/acknowledge',
      ]);
      expect(refresh).toHaveBeenCalled();
    });
  });

  it('shows partial-failure error and still refreshes', async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) })
      .mockResolvedValueOnce({ ok: false, status: 500, json: () => Promise.resolve({}) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) });

    const onClose = vi.fn();
    const user = userEvent.setup();
    render(
      <BulkActionModal
        action="acknowledge"
        sku_label="WIDGET-7"
        observers={observers}
        onClose={onClose}
      />,
    );
    await user.click(screen.getByRole('button', { name: /confirm/i }));

    expect(await screen.findByText(/2 of 3/i)).toBeInTheDocument();
    expect(refresh).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('renders informational copy on decline', () => {
    render(
      <BulkActionModal
        action="decline"
        sku_label="WIDGET-7"
        observers={observers}
        onClose={() => {}}
      />,
    );
    expect(screen.getByText(/informational/i)).toBeInTheDocument();
  });

  it('keeps modal open and shows error when all requests fail', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500, json: () => Promise.resolve({}) });
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(
      <BulkActionModal
        action="acknowledge"
        sku_label="WIDGET-7"
        observers={observers}
        onClose={onClose}
      />,
    );
    await user.click(screen.getByRole('button', { name: /confirm/i }));

    expect(await screen.findByText(/Couldn't accept any/i)).toBeInTheDocument();
    expect(refresh).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('uses correct past-tense verb in partial-failure message for defer', async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) })
      .mockResolvedValueOnce({ ok: false, status: 500, json: () => Promise.resolve({}) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) });
    const user = userEvent.setup();
    render(
      <BulkActionModal
        action="defer"
        sku_label="WIDGET-7"
        observers={observers}
        onClose={() => {}}
      />,
    );
    await user.click(screen.getByRole('button', { name: /confirm/i }));
    expect(await screen.findByText(/Deferred 2 of 3/)).toBeInTheDocument();
  });
});
