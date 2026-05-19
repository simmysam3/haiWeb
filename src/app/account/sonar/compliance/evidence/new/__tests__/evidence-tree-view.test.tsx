import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { EvidenceTreeView } from '../evidence-tree-view';

global.fetch = vi.fn(async () => ({
  ok: true,
  json: async () => ({
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
  }),
})) as never;

describe('EvidenceTreeView', () => {
  it('fetches the tree and renders an attestation pill', async () => {
    render(<EvidenceTreeView draftId="d1" />);
    await waitFor(() => expect(screen.getByText(/third party audited/i)).toBeInTheDocument());
  });
});
