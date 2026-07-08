import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AgentsPanel } from '../agents-panel';

function mockFetchOnceJson(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

describe('AgentsPanel', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('shows the empty state with a link to Agent Software when there are no agents', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(mockFetchOnceJson({ agents: [] }));
    render(<AgentsPanel />);
    await screen.findByText(/no agents provisioned yet/i);
    expect(screen.getByRole('link', { name: /agent software/i })).toBeInTheDocument();
  });

  it('renders a distinct error state (not the empty state) when the list fails to load', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      mockFetchOnceJson({ error: 'Internal server error' }, 500),
    );
    render(<AgentsPanel />);
    await screen.findByText(/could not load your agents/i);
    // An outage must NOT masquerade as "you have no agents".
    expect(screen.queryByText(/no agents provisioned yet/i)).not.toBeInTheDocument();
  });

  it('does not get stuck on "Loading agents…" when the list response is not JSON', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('<html>502 Bad Gateway</html>', { status: 502 }),
    );
    render(<AgentsPanel />);
    await screen.findByRole('button', { name: /retry/i });
    expect(screen.queryByText(/loading agents/i)).not.toBeInTheDocument();
  });

  it('creating an agent reveals the .env once with the secret', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    fetchMock.mockResolvedValueOnce(mockFetchOnceJson({ agents: [] }));               // initial list
    fetchMock.mockResolvedValueOnce(mockFetchOnceJson({                                // POST create
      id: 'aid', name: 'Bot', client_id: 'agent-aid', participant_id: 'pid',
      status: 'active', registered_at: 'r', client_secret: 'sekret',
      auth_token_endpoint: 't', auth_issuer: 'i', auth_jwks_uri: 'j', api_base_url: 'a',
    }, 201));
    fetchMock.mockResolvedValueOnce(mockFetchOnceJson({ agents: [{                     // refresh list
      id: 'aid', name: 'Bot', client_id: 'agent-aid', participant_id: 'pid',
      status: 'active', agent_endpoint: null, last_heartbeat_at: null, registered_at: 'r',
    }] }));

    render(<AgentsPanel />);
    fireEvent.click(await screen.findByRole('button', { name: /create agent/i }));
    fireEvent.change(screen.getByLabelText(/name/i), { target: { value: 'Bot' } });
    fireEvent.click(screen.getByRole('button', { name: /^create$/i }));

    await waitFor(() => expect(screen.getByText(/KEYCLOAK_CLIENT_SECRET=sekret/)).toBeInTheDocument());
    expect(screen.getByText(/shown (only )?once/i)).toBeInTheDocument();

    // One-time reveal: closing the modal must clear the secret from the DOM.
    fireEvent.click(screen.getByRole('button', { name: /done/i }));
    await waitFor(() => expect(screen.queryByText(/KEYCLOAK_CLIENT_SECRET=sekret/)).not.toBeInTheDocument());
  });

  it('rotating an agent reveals the new secret without a fresh create', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    fetchMock.mockResolvedValueOnce(mockFetchOnceJson({ agents: [{
      id: 'aid', name: 'Bot', client_id: 'agent-aid', participant_id: 'pid',
      status: 'active', agent_endpoint: null, last_heartbeat_at: null, registered_at: 'r',
    }] }));
    fetchMock.mockResolvedValueOnce(mockFetchOnceJson({
      id: 'aid', name: 'Bot', client_id: 'agent-aid', participant_id: 'pid',
      status: 'active', registered_at: 'r', client_secret: 'new-sekret',
      auth_token_endpoint: 't', auth_issuer: 'i', auth_jwks_uri: 'j', api_base_url: 'a',
    }));

    render(<AgentsPanel />);
    fireEvent.click(await screen.findByRole('button', { name: /rotate/i }));

    await waitFor(() => expect(screen.getByText(/KEYCLOAK_CLIENT_SECRET=new-sekret/)).toBeInTheDocument());
  });

  it('surfaces an error and does not reveal a secret when rotate fails', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    fetchMock.mockResolvedValueOnce(mockFetchOnceJson({ agents: [{
      id: 'aid', name: 'Bot', client_id: 'agent-aid', participant_id: 'pid',
      status: 'active', agent_endpoint: null, last_heartbeat_at: null, registered_at: 'r',
    }] }));
    fetchMock.mockResolvedValueOnce(mockFetchOnceJson(
      { error: { code: 'AGENT_REVOKED', message: 'Agent has been revoked' } }, 409,
    ));

    render(<AgentsPanel />);
    fireEvent.click(await screen.findByRole('button', { name: /rotate/i }));

    await screen.findByText(/agent has been revoked/i);
    // A failed rotate must never pop the one-time reveal (would imply a new secret).
    expect(screen.queryByText(/KEYCLOAK_CLIENT_SECRET/)).not.toBeInTheDocument();
  });

  it('surfaces an error when revoke fails', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    fetchMock.mockResolvedValueOnce(mockFetchOnceJson({ agents: [{
      id: 'aid', name: 'Bot', client_id: 'agent-aid', participant_id: 'pid',
      status: 'active', agent_endpoint: null, last_heartbeat_at: null, registered_at: 'r',
    }] }));
    fetchMock.mockResolvedValueOnce(mockFetchOnceJson({ error: 'Internal server error' }, 500));

    render(<AgentsPanel />);
    fireEvent.click(await screen.findByRole('button', { name: /revoke/i }));

    // The failure must be visible (not swallowed) — the surfaced BFF message.
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/internal server error/i);
  });

  it('shows the real BFF cause when create fails', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    fetchMock.mockResolvedValueOnce(mockFetchOnceJson({ agents: [] }));
    fetchMock.mockResolvedValueOnce(mockFetchOnceJson(
      { error: { code: 'FORBIDDEN', message: 'You do not have the account_admin role' } }, 403,
    ));

    render(<AgentsPanel />);
    fireEvent.click(await screen.findByRole('button', { name: /create agent/i }));
    fireEvent.change(screen.getByLabelText(/name/i), { target: { value: 'Bot' } });
    fireEvent.click(screen.getByRole('button', { name: /^create$/i }));

    await screen.findByText(/you do not have the account_admin role/i);
  });

  it('revoking an agent refreshes the list and hides rotate/revoke for it', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    fetchMock.mockResolvedValueOnce(mockFetchOnceJson({ agents: [{
      id: 'aid', name: 'Bot', client_id: 'agent-aid', participant_id: 'pid',
      status: 'active', agent_endpoint: null, last_heartbeat_at: null, registered_at: 'r',
    }] }));
    fetchMock.mockResolvedValueOnce(mockFetchOnceJson({ id: 'aid', status: 'revoked' }));
    fetchMock.mockResolvedValueOnce(mockFetchOnceJson({ agents: [{
      id: 'aid', name: 'Bot', client_id: 'agent-aid', participant_id: 'pid',
      status: 'revoked', agent_endpoint: null, last_heartbeat_at: null, registered_at: 'r',
    }] }));

    render(<AgentsPanel />);
    fireEvent.click(await screen.findByRole('button', { name: /revoke/i }));

    await waitFor(() => expect(screen.queryByRole('button', { name: /rotate/i })).not.toBeInTheDocument());
    expect(screen.queryByRole('button', { name: /revoke/i })).not.toBeInTheDocument();
  });
});
