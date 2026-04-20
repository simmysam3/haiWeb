import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { InstallKeyModal } from '../install-key-modal';

describe('InstallKeyModal', () => {
  beforeEach(() => {
    // mock SubtleCrypto.digest to return a predictable 32-byte buffer
    Object.assign(globalThis.crypto, {
      subtle: {
        digest: vi.fn().mockResolvedValue(new Uint8Array(32).fill(0xab).buffer),
      },
    });
  });

  it('shows preview after paste + Preview click', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          key_id: 'k1',
          generator_participant_id: 'gen',
          generator_legal_name: 'USAGOV',
          friendly_name: 'Audit',
          purpose: null,
          expires_at: null,
          required_fields: [
            { field: 'facility_country', shareable: true },
            { field: 'manufacturing_date', shareable: false },
          ],
          requested_fields: [],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    ) as unknown as typeof fetch;

    render(<InstallKeyModal open={true} onClose={() => {}} onInstalled={() => {}} />);
    await userEvent.type(screen.getByLabelText(/paste key/i), 'plaintext-value');
    await userEvent.click(screen.getByRole('button', { name: /preview/i }));

    await waitFor(() => {
      expect(screen.getByText(/USAGOV/i)).toBeInTheDocument();
    });
    // Install button disabled because one required field is not shareable
    const installBtn = screen.getByRole('button', { name: /^install$/i });
    expect(installBtn).toBeDisabled();
  });

  it('enables Install when every required field is shareable', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          key_id: 'k1',
          generator_participant_id: 'gen',
          generator_legal_name: 'USAGOV',
          friendly_name: 'Audit',
          purpose: null,
          expires_at: null,
          required_fields: [{ field: 'facility_country', shareable: true }],
          requested_fields: [],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    ) as unknown as typeof fetch;

    render(<InstallKeyModal open={true} onClose={() => {}} onInstalled={() => {}} />);
    await userEvent.type(screen.getByLabelText(/paste key/i), 'value');
    await userEvent.click(screen.getByRole('button', { name: /preview/i }));

    await waitFor(() => {
      expect(screen.getByText(/USAGOV/i)).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /^install$/i })).not.toBeDisabled();
  });
});
