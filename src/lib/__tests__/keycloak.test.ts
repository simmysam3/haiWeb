import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { refreshToken, endSession } from '../keycloak';

describe('keycloak token endpoints send client_secret (confidential client)', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ access_token: 'a', refresh_token: 'r', expires_in: 1 }) });
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('refreshToken includes client_secret in the body', async () => {
    await refreshToken('rt');
    const body = fetchMock.mock.calls[0][1].body as URLSearchParams;
    expect(body.get('grant_type')).toBe('refresh_token');
    expect(body.has('client_secret')).toBe(true);
  });

  it('endSession includes client_secret in the body', async () => {
    await endSession('rt');
    const body = fetchMock.mock.calls[0][1].body as URLSearchParams;
    expect(body.has('client_secret')).toBe(true);
  });
});
