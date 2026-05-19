import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DispatchDecisionPanel, type DraftWire } from '../dispatch-decision-panel';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: () => {}, push: () => {} }),
}));

const TREE_BODY = {
  draft_response_id: 'd1', dispatch_decision: 'cached',
  tree_roots: [{
    participant_id: '33333333-3333-3333-3333-333333333333', vendor_legal_name: 'Acme',
    payload: { kind: 'audit', product_id: 'SKU-1', disclosure_data: null, class_ids: [],
      origin: { country_of_origin: 'US', state_province: null, city: null, plant_address: null, plant_identifier: null, vendor_name: null },
      operational_status: { lead_time_meets: null, capacity: null, delivery_state: null } },
    depth_level: 0, components: [], gap: null, synthesis_mode: 'direct', identity_redacted: false,
    attestations: [{ entry_type: 'primary_manufacture', attestation_kind: 'third_party_audited' }],
    current_annotation: null,
  }],
};

const DRAFT: DraftWire = {
  draft_response_id: 'd1',
  scope_payload: { skus: ['SKU-1'], resolved_skus: ['SKU-1'], unknown_skus: [] },
  dispatch_availability: {
    total_skus: 1, covered_count: 1, uncovered_skus: [],
    oldest_applicable_run_age_days: 3,
  },
};

beforeEach(() => {
  global.fetch = vi.fn(async (url: unknown, init?: { method?: string }) => {
    const u = String(url);
    if (u.includes('/dispatch') && init?.method === 'POST') {
      return { ok: true, json: async () => ({ dispatch_decision: 'cached', bound_run_id: null, source_run_ids: null }) };
    }
    if (u.includes('/tree')) {
      return { ok: true, json: async () => TREE_BODY };
    }
    return { ok: true, json: async () => ({}) };
  }) as never;
});

function renderPanelWithCachedDispatch() {
  return render(<DispatchDecisionPanel draft={DRAFT} />);
}

describe('DispatchDecisionPanel review stage', () => {
  it('renders the review tree after a cached dispatch resolves', async () => {
    renderPanelWithCachedDispatch();
    fireEvent.click(screen.getByRole('button', { name: /use cached/i }));
    await waitFor(() => expect(screen.getByText(/third party audited/i)).toBeInTheDocument());
  });
});
