import { afterEach, describe, expect, it, vi } from 'vitest';

const getSession = vi.fn();
const getToken = vi.fn();
const createHaiwaveClient = vi.fn((token: string, pid: string) => ({ token, pid }));

vi.mock('../auth', () => ({ getSession: () => getSession(), getToken: () => getToken() }));
vi.mock('../haiwave-api', () => ({ createHaiwaveClient: (t: string, p: string) => createHaiwaveClient(t, p) }));

import { getServerHaiwaveClient, fetchFromApi } from '../server-haiwave-client';

const JWT = 'header.body.sig';

afterEach(() => {
  getSession.mockReset();
  getToken.mockReset();
  createHaiwaveClient.mockClear();
});

describe('getServerHaiwaveClient', () => {
  it('builds a client from the session participant + token', async () => {
    getSession.mockResolvedValue({ participant: { id: 'p-1' } });
    getToken.mockResolvedValue(JWT);
    await getServerHaiwaveClient();
    expect(createHaiwaveClient).toHaveBeenCalledWith(JWT, 'p-1');
  });

  it('throws when there is no session', async () => {
    getSession.mockResolvedValue(null);
    getToken.mockResolvedValue(JWT);
    await expect(getServerHaiwaveClient()).rejects.toThrow();
  });

  it('throws when the token is not a JWT (dev stand-alone cookie)', async () => {
    getSession.mockResolvedValue({ participant: { id: 'p-1' } });
    getToken.mockResolvedValue('not-a-jwt');
    await expect(getServerHaiwaveClient()).rejects.toThrow();
  });
});

describe('fetchFromApi', () => {
  it('returns the handler result when the client is available', async () => {
    getSession.mockResolvedValue({ participant: { id: 'p-1' } });
    getToken.mockResolvedValue(JWT);
    const out = await fetchFromApi(async () => 42, -1);
    expect(out).toBe(42);
  });

  it('returns the fallback when no session/token is available', async () => {
    getSession.mockResolvedValue(null);
    getToken.mockResolvedValue(null);
    expect(await fetchFromApi(async () => 42, -1)).toBe(-1);
  });

  it('returns the fallback when the handler throws', async () => {
    getSession.mockResolvedValue({ participant: { id: 'p-1' } });
    getToken.mockResolvedValue(JWT);
    expect(await fetchFromApi(async () => { throw new Error('upstream down'); }, -1)).toBe(-1);
  });
});
