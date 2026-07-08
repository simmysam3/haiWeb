import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createHaiwaveClient } from '../haiwave-api';

describe('HaiwaveClient agent methods', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('createAgent POSTs the name to the participant agents endpoint', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ id: 'aid', client_id: 'agent-aid', client_secret: 's' }), {
        status: 201, headers: { 'content-type': 'application/json' },
      }),
    );
    const client = createHaiwaveClient('token', 'participant-1');
    const cred = await client.createAgent('Bot');
    expect(cred.client_secret).toBe('s');
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('/api/v1/participants/me/agents');
    expect((init as RequestInit).method).toBe('POST');
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({ name: 'Bot' });
  });

  it('revokeAgent POSTs to the revoke sub-path', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ id: 'aid', status: 'revoked' }), {
        status: 200, headers: { 'content-type': 'application/json' },
      }),
    );
    const client = createHaiwaveClient('token', 'participant-1');
    const summary = await client.revokeAgent('aid');
    expect(summary.status).toBe('revoked');
    expect(String(fetchMock.mock.calls[0][0])).toContain('/api/v1/participants/me/agents/aid/revoke');
  });

  it('listAgents GETs the participant agents endpoint', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ agents: [] }), {
        status: 200, headers: { 'content-type': 'application/json' },
      }),
    );
    const client = createHaiwaveClient('token', 'participant-1');
    const result = await client.listAgents();
    expect(result).toEqual({ agents: [] });
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('/api/v1/participants/me/agents');
    expect((init as RequestInit).method).toBe('GET');
  });

  it('rotateAgentSecret POSTs to the rotate sub-path', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ id: 'aid', client_secret: 'new-secret' }), {
        status: 200, headers: { 'content-type': 'application/json' },
      }),
    );
    const client = createHaiwaveClient('token', 'participant-1');
    const cred = await client.rotateAgentSecret('aid');
    expect(cred.client_secret).toBe('new-secret');
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('/api/v1/participants/me/agents/aid/rotate');
    expect((init as RequestInit).method).toBe('POST');
  });
});
