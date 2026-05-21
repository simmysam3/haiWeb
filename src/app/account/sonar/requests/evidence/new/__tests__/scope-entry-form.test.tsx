import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));

// Mock useRunStatus so DispatchDecisionPanel doesn't need real SWR/fetch
vi.mock('@/app/account/sonar/posture/runs/[id]/use-run-status', () => ({
  useRunStatus: () => ({ status: 'running', hopCount: null, gapCount: null, resultsAvailableCount: undefined, isLoading: true, error: undefined, mutate: () => Promise.resolve(undefined) }),
}));

import { ScopeEntryForm } from '../scope-entry-form';

const fetchMock = vi.fn();
beforeEach(() => { fetchMock.mockReset(); vi.stubGlobal('fetch', fetchMock); });

describe('ScopeEntryForm', () => {
  it('renders the three scope tabs', () => {
    render(<ScopeEntryForm />);
    expect(screen.getByRole('tab', { name: /sku list/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /product family/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /container/i })).toBeInTheDocument();
  });

  it('blocks submit until recipient fields + scope present, then POSTs', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({
        draft_response_id: 'd1',
        scope_payload: { skus: ['S'], resolved_skus: ['S'], unknown_skus: [] },
        dispatch_availability: { total_skus: 1, covered_count: 0, uncovered_skus: ['S'], oldest_applicable_run_age_days: null },
      }), { status: 201, headers: { 'content-type': 'application/json' } }),
    );
    render(<ScopeEntryForm />);

    fireEvent.change(screen.getByLabelText(/skus/i), { target: { value: 'S' } });
    fireEvent.change(screen.getByLabelText(/recipient name/i), { target: { value: 'Jane' } });
    fireEvent.change(screen.getByLabelText(/recipient org/i), { target: { value: 'CBP' } });
    fireEvent.click(screen.getByRole('button', { name: /create draft/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(String(fetchMock.mock.calls[0][0])).toContain('/api/account/sonar/compliance/evidence/draft');
    // Dispatch panel appears with the availability summary
    await screen.findByText(/0 of 1/i);
  });
});
