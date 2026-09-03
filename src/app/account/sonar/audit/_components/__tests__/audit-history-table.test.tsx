import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { AuditHistoryTable } from '../audit-history-table';

beforeEach(() => {
  global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ runs: [] }) });
});

// v1.85 fix wave (I2) — archived-mode empty state must not tell the user to
// trigger a run: a deleted audit can't be triggered again. The table owns
// this (it already knows `archived`), overriding the caller's emptyMessage
// when archived is true, so the definition pages need no per-page change.
describe('<AuditHistoryTable> — archived-mode empty state (fix wave I2)', () => {
  it('shows the archived copy when archived and empty, ignoring a caller-supplied emptyMessage', async () => {
    render(
      <AuditHistoryTable
        initialRows={[]}
        auditorCountry={undefined}
        templateId="t-i2-archived-1"
        archived
        emptyMessage="No runs yet for this audit. Use Run now, or wait for the next scheduled fire."
      />,
    );
    await waitFor(() => {
      expect(
        screen.getByText('No archived runs. Runs are archived when their audit is deleted.'),
      ).toBeInTheDocument();
    });
    expect(screen.queryByText(/Use Run now/)).not.toBeInTheDocument();
  });

  it('keeps the non-archived empty copy unchanged when archived is false/absent', async () => {
    render(
      <AuditHistoryTable
        initialRows={[]}
        auditorCountry={undefined}
        templateId="t-i2-active-1"
      />,
    );
    await waitFor(() => {
      expect(
        screen.getByText(
          'No audit runs yet. Trigger a run from a configuration or use the "+ New Audit" action above.',
        ),
      ).toBeInTheDocument();
    });
  });
});
