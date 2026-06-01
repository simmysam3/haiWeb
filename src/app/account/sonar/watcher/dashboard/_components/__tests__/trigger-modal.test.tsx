import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const fetchMock = vi.fn();
global.fetch = fetchMock as unknown as typeof fetch;

import { TriggerModal } from '../trigger-modal';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('TriggerModal', () => {
  it('lead_time_distribution is pre-selected on first render', () => {
    render(<TriggerModal onClose={() => {}} onSuccess={() => {}} />);
    const leadTime = screen.getByLabelText(/Lead time distribution/i) as HTMLInputElement;
    const capacity = screen.getByLabelText(/Capacity utilization band/i) as HTMLInputElement;
    expect(leadTime.checked).toBe(true);
    expect(capacity.checked).toBe(false);
  });

  it('POSTs the selected signal_types and calls onSuccess on 200', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ run_id: 'r1' }) });
    const onSuccess = vi.fn();
    const user = userEvent.setup();
    render(<TriggerModal onClose={() => {}} onSuccess={onSuccess} />);

    await user.click(screen.getByLabelText(/Capacity utilization band/i));
    await user.click(screen.getByRole('button', { name: /Run observation/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe('/api/account/sonar/watcher/runs');
      expect((init as RequestInit).method).toBe('POST');
      const body = JSON.parse((init as RequestInit).body as string) as { signal_types: string[] };
      expect(body.signal_types.sort()).toEqual([
        'capacity_utilization_band',
        'lead_time_distribution',
      ]);
      expect(onSuccess).toHaveBeenCalled();
    });
  });

  it('shows an error and does not POST when no signal is selected', async () => {
    const user = userEvent.setup();
    const onSuccess = vi.fn();
    render(<TriggerModal onClose={() => {}} onSuccess={onSuccess} />);

    // Uncheck the only pre-selected box.
    await user.click(screen.getByLabelText(/Lead time distribution/i));
    await user.click(screen.getByRole('button', { name: /Run observation/i }));

    expect(await screen.findByText(/Pick at least one/i)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it('renders a server-side error when haiCore returns non-OK', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 500, json: () => Promise.resolve({}) });
    const onSuccess = vi.fn();
    const user = userEvent.setup();
    render(<TriggerModal onClose={() => {}} onSuccess={onSuccess} />);
    await user.click(screen.getByRole('button', { name: /Run observation/i }));
    expect(await screen.findByText(/Trigger failed \(500\)/i)).toBeInTheDocument();
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it('renders a Save-as-Watch link to the watcher creation flow', () => {
    // v.1.45 (#98): watcher entry points go to the dedicated /watchers/new
    // flow, not the generic templates wizard (which is now PD-only).
    render(<TriggerModal onClose={() => {}} onSuccess={() => {}} />);
    const link = screen.getByRole('link', { name: /save as watch instead/i });
    expect(link).toHaveAttribute('href', '/account/sonar/watchers/new');
  });
});
