import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { RunTemplate } from '@haiwave/protocol';
import { WatcherDefinitionDetail } from '../watcher-definition-detail';

// The scope picker is irrelevant to this bug (it lives in the wrapper's
// scope-state resync contract). Stub it so the test is deterministic and
// doesn't depend on the picker's counterparty/SKU plumbing.
vi.mock('../../../../new/_components/watcher-scope-picker', () => ({
  WatcherScopePicker: () => <div data-testid="watcher-scope-picker" />,
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

const fetchMock = vi.fn();
beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

// A scheduled watcher (daily) so the Drift step is editable (not locked).
// scope has NO drift_thresholds yet — the user is about to set them.
const baseWatcher: RunTemplate = {
  template_id: 'watch-1',
  template_name: 'lt-watcher',
  observation_class: 'watcher',
  cadence: { kind: 'daily', hour_local: 9, minute_local: 0, timezone: 'UTC' },
  enabled: true,
  retention_days: 90,
  created_at: '2026-05-08T12:00:00.000Z',
  last_run_at: null,
  scope: {
    kind: 'watcher',
    authorization_basis: 'bilateral',
    counterparties: ['acme-corp'],
    signal_types: ['lead_time_distribution'],
    skus: [],
    depth_limit: 1,
  },
} as unknown as RunTemplate;

// The same template as the server returns it AFTER the drift save round-trips
// (router.refresh re-fetches with cache:'no-store'): scope now carries the
// persisted drift_thresholds with the new noise floor.
const savedWatcher: RunTemplate = {
  ...baseWatcher,
  scope: {
    ...(baseWatcher.scope as object),
    drift_thresholds: {
      short_baseline_threshold_days: 20,
      noise_floor_days: 7,
      severity_warning_pct: 12,
      severity_critical_pct: 20,
    },
  },
} as unknown as RunTemplate;

describe('WatcherDefinitionDetail — save clears the unsaved-changes bar', () => {
  it('clears "Unsaved changes" after a successful drift save + refresh', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({}) } as Response);
    const { rerender } = render(<WatcherDefinitionDetail template={baseWatcher} />);

    // No save bar at rest (drift_thresholds default → not dirty).
    expect(screen.queryByRole('button', { name: /save changes/i })).toBeNull();

    // Change the noise floor → form becomes dirty, save bar appears.
    await userEvent.click(
      screen.getByRole('button', { name: /Alter drift thresholds/i }),
    );
    const noise = screen.getByLabelText(/Noise floor/i);
    await userEvent.clear(noise);
    await userEvent.type(noise, '7');
    expect(
      screen.getByRole('button', { name: /save changes/i }),
    ).toBeInTheDocument();

    // Save it.
    await userEvent.click(screen.getByRole('button', { name: /save changes/i }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    // router.refresh re-fetches fresh server data — re-render the wrapper with
    // the persisted template (drift_thresholds now on scope).
    rerender(<WatcherDefinitionDetail template={savedWatcher} />);

    // The save succeeded and the data round-tripped, so the form is no longer
    // dirty: the "Unsaved changes" bar MUST be gone.
    await waitFor(() =>
      expect(screen.queryByText(/unsaved changes/i)).toBeNull(),
    );
    expect(screen.queryByRole('button', { name: /save changes/i })).toBeNull();
  });
});
