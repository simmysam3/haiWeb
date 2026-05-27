import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { ColumnPack } from '../column-pack';
import { RunHistoryTable } from '../run-history-table';

interface FakeRun {
  run_id: string;
  template_name?: string;
  status: 'running' | 'complete';
}

const fakeColumns: ColumnPack<FakeRun> = {
  columns: [
    { key: 'name', label: 'Name', render: (r) => r.template_name ?? r.run_id },
    { key: 'status', label: 'Status', render: (r) => r.status },
  ],
};

beforeEach(() => {
  global.fetch = vi.fn();
});

// SWR caches by URL across tests; give every test a unique endpoint so the
// cache doesn't leak fixtures into the next assertion.
let pollEndpoint = '/api/test/runs/initial';

describe('<RunHistoryTable>', () => {
  beforeEach(() => {
    pollEndpoint = `/api/test/runs/${Math.random().toString(36).slice(2)}`;
  });

  it('renders initial SSR rows immediately', () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ runs: [{ run_id: 'a', template_name: 'Apex', status: 'complete' }] }),
    });
    const initial: FakeRun[] = [
      { run_id: 'a', template_name: 'Apex', status: 'complete' },
    ];
    render(
      <RunHistoryTable<FakeRun>
        initialRows={initial}
        columns={fakeColumns}
        pollEndpoint={pollEndpoint}
        keyFn={(r) => r.run_id}
        emptyMessage="empty"
      />,
    );
    expect(screen.getByText('Apex')).toBeInTheDocument();
    expect(screen.getByText('complete')).toBeInTheDocument();
  });

  it('renders empty state when initialRows is empty and SWR returns empty', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ runs: [] }),
    });
    render(
      <RunHistoryTable<FakeRun>
        initialRows={[]}
        columns={fakeColumns}
        pollEndpoint={pollEndpoint}
        keyFn={(r) => r.run_id}
        emptyMessage="No runs yet."
      />,
    );
    await waitFor(() => {
      expect(screen.getByText('No runs yet.')).toBeInTheDocument();
    });
  });

  it('renders an error banner when SWR fetch fails', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({}),
    });
    render(
      <RunHistoryTable<FakeRun>
        initialRows={[]}
        columns={fakeColumns}
        pollEndpoint={pollEndpoint}
        keyFn={(r) => r.run_id}
        emptyMessage="empty"
      />,
    );
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });
});
