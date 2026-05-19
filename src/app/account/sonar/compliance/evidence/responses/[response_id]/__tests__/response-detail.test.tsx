import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { ResponseDetail } from '../response-detail';
import type { EvidenceResponse } from '@haiwave/protocol';

const RESPONSE: EvidenceResponse = {
  response_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  initiator_participant_id: '22222222-2222-2222-2222-222222222222',
  scope_shape: 'sku_list',
  scope_payload: { skus: ['SKU-1'], resolved_skus: ['SKU-1'], unknown_skus: [] },
  recipient_name: 'US Customs',
  recipient_org: 'CBP',
  recipient_type: 'customs',
  purpose_narrative: 'border clearance test',
  deadline: null,
  source_run_ids: ['55555555-5555-5555-5555-555555555555'],
  source_snapshot_ids: [],
  annotation_refs: [
    {
      annotation_id: '11111111-1111-1111-1111-111111111111',
      version: 1,
      target_vendor_participant_id: '33333333-3333-3333-3333-333333333333',
      target_component_ref: 'SKU-1',
      target_depth: 0,
      narrative: 'cert seen out of band',
      attachment_uri: null,
      attachment_hash: null,
      signer_user_id: '44444444-4444-4444-4444-444444444444',
      created_at: '2026-05-19T00:00:00.000Z',
    },
  ],
  dispatch_decision: 'cached',
  document_hash: 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
  exported_at: '2026-05-19T10:00:00.000Z',
  exported_by: '44444444-4444-4444-4444-444444444444',
};

const DOCUMENT_JSON = {
  response: {
    recipient_name: 'US Customs', recipient_org: 'CBP', recipient_type: 'customs',
    purpose_narrative: 'border clearance test', deadline: null,
    exported_by: '44444444-4444-4444-4444-444444444444',
    exported_at: '2026-05-19T10:00:00.000Z',
    scope_shape: 'sku_list', scope_payload: { skus: ['SKU-1'], resolved_skus: ['SKU-1'], unknown_skus: [] },
  },
  source_run_ids: ['55555555-5555-5555-5555-555555555555'],
  source_snapshot_ids: [],
  dispatch_decision: 'cached',
  tree: [],
  document_hash: 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
};

describe('ResponseDetail', () => {
  beforeEach(() => {
    global.fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      headers: {
        get: (k: string) => {
          if (k === 'X-Document-Hash-Matches') return 'true';
          if (k === 'Content-Type') return 'application/json';
          return null;
        },
      },
      json: async () => DOCUMENT_JSON,
      text: async () => JSON.stringify(DOCUMENT_JSON),
    })) as never;
  });

  it('renders metadata: recipient, purpose, hash', async () => {
    render(<ResponseDetail response={RESPONSE} />);
    expect(screen.getByText(/US Customs/)).toBeInTheDocument();
    expect(screen.getByText(/border clearance test/)).toBeInTheDocument();
    expect(screen.getByText(/abcdef1234567890abcdef/)).toBeInTheDocument();
  });

  it('renders annotation narratives', () => {
    render(<ResponseDetail response={RESPONSE} />);
    expect(screen.getByText(/cert seen out of band/)).toBeInTheDocument();
  });

  it('renders three document download links (pdf, html, json)', () => {
    render(<ResponseDetail response={RESPONSE} />);
    const links = screen.getAllByRole('link');
    const hrefs = links.map((l) => l.getAttribute('href') ?? '');
    expect(hrefs.some((h) => h.includes('format=pdf'))).toBe(true);
    expect(hrefs.some((h) => h.includes('format=html'))).toBe(true);
    expect(hrefs.some((h) => h.includes('format=json'))).toBe(true);
  });

  it('shows hash-divergence warning when X-Document-Hash-Matches is false', async () => {
    global.fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      headers: {
        get: (k: string) => {
          if (k === 'X-Document-Hash-Matches') return 'false';
          return null;
        },
      },
      text: async () => JSON.stringify(DOCUMENT_JSON),
    })) as never;
    render(<ResponseDetail response={RESPONSE} />);
    await waitFor(() => expect(
      screen.getByText(/regenerated document hash diverges/i),
    ).toBeInTheDocument());
  });
});
