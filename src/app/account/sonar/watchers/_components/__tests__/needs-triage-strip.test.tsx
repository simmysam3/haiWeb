import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { mutate } from 'swr';
import { NeedsTriageStrip } from '../needs-triage-strip';

beforeEach(async () => {
  // Purge the SWR global cache so a previous test's cached response cannot
  // bleed into the next one.  Without this, the "empty alerts" test fills
  // the cache for the triage-alerts key and the second test never sees its
  // non-empty fetch mock (SWR serves the stale value immediately).
  await mutate(() => true, undefined, { revalidate: false });
  global.fetch = vi.fn();
});

describe('<NeedsTriageStrip>', () => {
  it('renders nothing when alerts is empty', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ alerts: [] }),
    });
    const { container } = render(<NeedsTriageStrip />);
    await waitFor(() => {
      expect(container.firstChild).toBeNull();
    });
  });

  it('renders the alert card and rows when alerts is non-empty', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        alerts: [
          {
            id: 'alert-1',
            signal_type: 'lead_time_distribution',
            watcher_name: 'Apex LT watcher',
            counterparty_name: 'Apex Metals',
            drift_description: 'calibrated LT spiked',
            delta_chip: '8d → 28d (+250%)',
            run_id: 'run-abc',
          },
        ],
      }),
    });
    render(<NeedsTriageStrip />);
    await waitFor(() => {
      expect(screen.getByText('Apex LT watcher')).toBeInTheDocument();
      expect(screen.getByText(/calibrated LT spiked/)).toBeInTheDocument();
      expect(screen.getByText(/8d → 28d/)).toBeInTheDocument();
    });
  });
});
