import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { EvidenceTreeView } from '../evidence-tree-view';

const TREE_WITH_GAP_AND_ANNOTATION = {
  draft_response_id: 'd1',
  dispatch_decision: 'cached',
  tree_roots: [{
    participant_id: '33333333-3333-3333-3333-333333333333', vendor_legal_name: 'Acme',
    payload: { kind: 'audit', product_id: 'SKU-1', disclosure_data: null, class_ids: [],
      origin: { country_of_origin: 'US', state_province: null, city: null, plant_address: null, plant_identifier: null, vendor_name: null },
      operational_status: { lead_time_meets: null, capacity: null, delivery_state: null } },
    depth_level: 0, components: [], gap: null, synthesis_mode: 'direct', identity_redacted: false,
    attestations: [{ entry_type: null, attestation_kind: 'unsubstantiated_gap' }],
    current_annotation: {
      annotation_id: 'ann-77', draft_response_id: 'd1',
      target_vendor_participant_id: '33333333-3333-3333-3333-333333333333',
      target_component_ref: 'SKU-1', target_depth: 0,
      attestation_kind: 'verified_out_of_band',
      narrative: 'we hold it directly', attachment_uri: null, attachment_hash: null,
      signer_user_id: '44444444-4444-4444-4444-444444444444',
      version: 1, created_at: '2026-05-19T00:00:00.000Z',
    },
  }],
};

const TREE_BASIC = {
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

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('EvidenceTreeView', () => {
  it('fetches the tree and renders an attestation pill', async () => {
    global.fetch = vi.fn(async () => ({
      ok: true, json: async () => TREE_BASIC,
    })) as never;
    render(<EvidenceTreeView draftId="d1" />);
    await waitFor(() => expect(screen.getByText(/third party audited/i)).toBeInTheDocument());
  });

  it('node with a current_annotation opens the drawer pre-filled and PATCHes on save (§4.5/P8-D5)', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (typeof url === 'string' && url.endsWith('/tree')) {
        return { ok: true, json: async () => TREE_WITH_GAP_AND_ANNOTATION } as never;
      }
      // annotation PATCH (or any subsequent call)
      return { ok: true, json: async () => ({}) } as never;
    });
    global.fetch = fetchMock as never;

    render(<EvidenceTreeView draftId="d1" />);

    const annotateBtn = await screen.findByRole('button', { name: /annotate/i });
    fireEvent.click(annotateBtn);

    // Drawer opens in edit mode pre-filled with the existing narrative.
    expect(await screen.findByText(/edit annotation/i)).toBeInTheDocument();
    expect(screen.getByDisplayValue('we hold it directly')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));

    await waitFor(() => {
      const patchCall = fetchMock.mock.calls.find(
        ([, init]) => init && (init as RequestInit).method === 'PATCH',
      );
      expect(patchCall).toBeTruthy();
      expect(patchCall![0]).toBe(
        '/api/account/sonar/compliance/evidence/draft/d1/annotations/ann-77',
      );
      expect((patchCall![1] as RequestInit).method).toBe('PATCH');
    });
  });
});
