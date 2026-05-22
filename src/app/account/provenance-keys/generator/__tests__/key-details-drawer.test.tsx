import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { KeyDetailsDrawer } from '../key-details-drawer';
import type { ProvenanceKeyWithCounts } from '@haiwave/protocol';

const SAMPLE: ProvenanceKeyWithCounts = {
  key_id: 'k1',
  generator_participant_id: 'p1',
  friendly_name: 'Key 1',
  key_hash: 'a'.repeat(64),
  required_fields: ['state_province'],
  requested_fields: ['vendor_name'],
  purpose: null,
  expires_at: null,
  enabled: true,
  revoked: false,
  revoked_at: null,
  created_at: '2026-04-18T00:00:00.000Z',
  active_installations: 0,
  total_installations: 0,
  active_compliant: 0,
  active_grace_pending: 0,
  active_non_compliant: 0,
};

describe('KeyDetailsDrawer', () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ installations: [] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    ) as unknown as typeof fetch;
  });

  it('renders required + requested fields', async () => {
    render(<KeyDetailsDrawer keyRow={SAMPLE} open={true} onClose={() => {}} onKeyChanged={() => {}} />);
    expect(screen.getByText(/state_province/i)).toBeInTheDocument();
    expect(screen.getByText(/vendor_name/i)).toBeInTheDocument();
  });

  it('fetches installations on mount and renders the returned list', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          installations: [
            {
              installation_id: 'i1',
              key_id: 'k1',
              installer_participant_id: 'installer-abc-def',
              accepted_required_fields: [],
              accepted_requested_fields: [],
              installed_at: '2026-04-18T00:00:00.000Z',
              updated_at: '2026-04-18T00:00:00.000Z',
              removed_at: null,
              auto_removed_reason: null,
              compliance: { status: 'compliant', missing_fields: [], grace_deadline: null },
            },
          ],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    ) as unknown as typeof fetch;

    render(<KeyDetailsDrawer keyRow={SAMPLE} open={true} onClose={() => {}} onKeyChanged={() => {}} />);

    // IdChip renders the first 6 chars of installer_participant_id followed
    // by "…" and exposes the full id via the title attribute. Earlier the
    // test asserted on the regex /installer-abc/i, which only worked when
    // IdChip rendered the full id. Use the title attribute now that
    // truncation is the default.
    await waitFor(() => {
      expect(screen.getByTitle('installer-abc-def')).toBeInTheDocument();
    });
  });

  it('renders Show key / Edit permissions / Revoke action buttons', () => {
    render(<KeyDetailsDrawer keyRow={SAMPLE} open={true} onClose={() => {}} onKeyChanged={() => {}} />);
    expect(screen.getByRole('button', { name: /show key/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /edit permissions/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /revoke/i })).toBeInTheDocument();
  });
});
