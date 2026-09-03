import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { WatcherHistoryTable } from '../watcher-history-table';

beforeEach(() => {
  global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ runs: [] }) });
});

// v1.85 fix wave (I2) — archived-mode empty state must not tell the user to
// trigger a run: a deleted watcher can't be triggered again. The table owns
// this (it already knows `archived`), overriding the caller's emptyMessage
// when archived is true, so the definition pages need no per-page change.
describe('<WatcherHistoryTable> — archived-mode empty state (fix wave I2)', () => {
  it('shows the archived copy when archived and empty, ignoring a caller-supplied emptyMessage', async () => {
    render(
      <WatcherHistoryTable
        initialRows={[]}
        templateId="t-i2-archived-1"
        archived
        emptyMessage="No runs yet for this watcher. Trigger one manually or wait for the next scheduled fire."
      />,
    );
    await waitFor(() => {
      expect(
        screen.getByText(
          'No archived runs. Runs are archived when their watcher is deleted with "Archive prior runs".',
        ),
      ).toBeInTheDocument();
    });
    expect(screen.queryByText(/Trigger one manually/)).not.toBeInTheDocument();
  });

  it('keeps the non-archived empty copy unchanged when archived is false/absent', async () => {
    render(<WatcherHistoryTable initialRows={[]} templateId="t-i2-active-1" />);
    await waitFor(() => {
      expect(
        screen.getByText(
          'No watcher runs yet. Create a watcher and trigger a run, or wait for a scheduled cadence to fire.',
        ),
      ).toBeInTheDocument();
    });
  });
});
