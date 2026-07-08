import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { RevealCredentialsModal } from '../reveal-credentials-modal';
import type { AgentCredential } from '@/lib/haiwave-api';

const cred: AgentCredential = {
  id: 'aid', name: 'Bot', client_id: 'agent-aid', participant_id: 'pid',
  status: 'active', registered_at: 'r', client_secret: 'sekret',
  auth_token_endpoint: 'https://auth/token', auth_issuer: 'https://auth/realm',
  auth_jwks_uri: 'https://auth/certs', api_base_url: 'https://api',
};

describe('RevealCredentialsModal', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('shows only the client secret inline, plus a config .env download', () => {
    render(<RevealCredentialsModal open onClose={() => {}} credential={cred} />);
    expect(screen.getByText('KEYCLOAK_CLIENT_SECRET=sekret')).toBeInTheDocument();
    expect(screen.getByText(/shown only once/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /download config \.env/i })).toBeInTheDocument();
    // The non-secret config is not dumped inline as a full block alongside the secret.
    expect(screen.queryByText(/HAICORE_BASE_URL=https:\/\/api/)).not.toBeInTheDocument();
  });

  it('surfaces a visible error when copying the secret fails (no silent swallow)', async () => {
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockRejectedValue(new Error('blocked')) },
    });
    render(<RevealCredentialsModal open onClose={() => {}} credential={cred} />);
    fireEvent.click(screen.getByRole('button', { name: /copy secret/i }));
    await screen.findByRole('alert');
    expect(screen.getByRole('alert')).toHaveTextContent(/copy failed/i);
  });

  it('copies the secret line on success', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    render(<RevealCredentialsModal open onClose={() => {}} credential={cred} />);
    fireEvent.click(screen.getByRole('button', { name: /copy secret/i }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('KEYCLOAK_CLIENT_SECRET=sekret'));
  });
});
