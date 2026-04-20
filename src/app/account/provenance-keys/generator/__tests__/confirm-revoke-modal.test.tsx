import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConfirmRevokeModal } from '../confirm-revoke-modal';
import type { ProvenanceKeyWithCounts } from '@haiwave/protocol';

const KEY: ProvenanceKeyWithCounts = {
  key_id: 'k1',
  generator_participant_id: 'p1',
  friendly_name: 'Revoke Me',
  key_hash: 'a'.repeat(64),
  required_fields: [],
  requested_fields: [],
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

describe('ConfirmRevokeModal', () => {
  it('disables the revoke button until the user types the key name', async () => {
    render(<ConfirmRevokeModal keyRow={KEY} open={true} onClose={() => {}} onRevoked={() => {}} />);
    const revokeBtn = screen.getByRole('button', { name: /revoke/i });
    expect(revokeBtn).toBeDisabled();
    await userEvent.type(screen.getByLabelText(/type.*to confirm/i), 'Revoke Me');
    expect(revokeBtn).not.toBeDisabled();
  });

  it('calls DELETE and then onRevoked when confirmed', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify({ key_id: 'k1', revoked: true }), { status: 200, headers: { 'content-type': 'application/json' } }),
    ) as unknown as typeof fetch;
    const onRevoked = vi.fn();
    render(<ConfirmRevokeModal keyRow={KEY} open={true} onClose={() => {}} onRevoked={onRevoked} />);
    await userEvent.type(screen.getByLabelText(/type.*to confirm/i), 'Revoke Me');
    await userEvent.click(screen.getByRole('button', { name: /revoke/i }));
    expect(globalThis.fetch).toHaveBeenCalledWith(
      `/api/account/provenance-keys/${KEY.key_id}`,
      expect.objectContaining({ method: 'DELETE' }),
    );
    expect(onRevoked).toHaveBeenCalled();
  });
});
