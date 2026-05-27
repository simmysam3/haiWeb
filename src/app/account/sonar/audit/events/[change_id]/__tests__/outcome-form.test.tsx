import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { OutcomeForm } from '../outcome-form';
import type { ComplianceChange } from '@haiwave/protocol';

const pushMock = vi.fn();
const refreshMock = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: pushMock, refresh: refreshMock,
    replace: vi.fn(), back: vi.fn(), forward: vi.fn(), prefetch: vi.fn(),
  }),
}));

const base: ComplianceChange = {
  change_id: 'c1', snapshot_id: 's1', prior_snapshot_id: 's0',
  change_kind: 'origin_shifted_country', vendor_participant_id: 'v1',
  component_ref: 'SKU-1',
  prior_value: { country_of_origin: 'VN' },
  current_value: { country_of_origin: 'CN' },
  severity: 'critical', detected_at: '2026-05-18T00:00:00.000Z',
  processed_at: null, processed_by: null,
  processed_outcome: null, processed_outcome_description: null,
  source_kind: 'audit', source_run_id: 'run-1', source_template_id: null,
  watcher_snapshot_id: null, prior_watcher_snapshot_id: null,
};

const change = (e: Partial<ComplianceChange>): ComplianceChange => ({ ...base, ...e });

beforeEach(() => {
  pushMock.mockReset();
  refreshMock.mockReset();
  globalThis.fetch = vi.fn();
});

describe('OutcomeForm', () => {
  it('renders the 6 outcome options', () => {
    render(<OutcomeForm change={change({})} />);
    const select = screen.getByLabelText(/^outcome$/i);
    const options = within(select as HTMLElement).getAllByRole('option');
    const labels = options.map((o) => o.textContent ?? '');
    expect(labels).toContain('Tier 1 follow up resulted in acceptable change');
    expect(labels).toContain('Tier 2 follow up resulted in adverse outcome');
    expect(labels).toContain('Replacement Supplier Identified');
    expect(labels).toContain('Temporary exemption for 90 days');
    expect(labels.some((l) => /Permanent Exemption.*no alternatives/.test(l))).toBe(true);
    expect(labels).toContain('Other Outcome');
  });

  it('reveals a description textarea when Other Outcome is selected', () => {
    render(<OutcomeForm change={change({})} />);
    expect(screen.queryByLabelText(/description or reason/i)).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/^outcome$/i), { target: { value: 'other' } });
    expect(screen.getByLabelText(/description or reason/i)).toBeInTheDocument();
  });

  it('keeps Process disabled when outcome=other and description empty', () => {
    render(<OutcomeForm change={change({})} />);
    fireEvent.change(screen.getByLabelText(/^outcome$/i), { target: { value: 'other' } });
    const submit = screen.getByRole('button', { name: /^process$/i });
    expect(submit).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/description or reason/i), { target: { value: 'manual override' } });
    expect(submit).not.toBeDisabled();
  });

  it('pre-populates from processed_outcome when already processed', () => {
    render(
      <OutcomeForm
        change={change({
          processed_at: '2026-05-25T12:00:00.000Z',
          processed_by: '00000000-0000-0000-0000-000000000aaa',
          severity: 'warning',
          processed_outcome: 'replacement_supplier',
          processed_outcome_description: null,
        })}
      />,
    );
    expect((screen.getByLabelText(/^outcome$/i) as HTMLSelectElement).value).toBe('replacement_supplier');
    expect(screen.getByRole('button', { name: /update outcome/i })).toBeInTheDocument();
  });

  it('on successful submit, POSTs the BFF and navigates back to the feed', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true, status: 200, json: async () => ({ change_id: 'c1' }),
    });
    render(<OutcomeForm change={change({})} />);
    fireEvent.change(screen.getByLabelText(/^outcome$/i), { target: { value: 'tier1_acceptable' } });
    fireEvent.click(screen.getByRole('button', { name: /^process$/i }));
    // Allow microtasks to flush. The handler awaits fetch, awaits res.json on
    // the !ok path (skipped here), then calls router.push.
    await vi.waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith('/account/sonar/audit/events');
    });
    expect(globalThis.fetch).toHaveBeenCalledWith(
      '/api/account/sonar/compliance/changes/c1/process',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'content-type': 'application/json' }),
        body: expect.stringContaining('tier1_acceptable'),
      }),
    );
  });
});
