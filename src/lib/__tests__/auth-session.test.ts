import { afterEach, describe, expect, it, vi } from 'vitest';

const cookieStore = { get: vi.fn() };
vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => cookieStore),
}));

import { getSession, getToken } from '../auth';

describe('getSession() non-JWT cookie handling', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    cookieStore.get.mockReset();
  });

  it('fails closed in production: a non-JWT cookie yields no session', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    cookieStore.get.mockReturnValue({ value: 'admin' });

    expect(await getSession()).toBeNull();
  });

  it('keeps the dev mock session outside production', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    cookieStore.get.mockReturnValue({ value: 'admin' });

    const session = await getSession();
    expect(session).not.toBeNull();
    expect(session?.is_admin).toBe(true);
  });
});

describe('getToken() dev-token minting', () => {
  const realFetch = globalThis.fetch;
  afterEach(() => {
    vi.unstubAllEnvs();
    cookieStore.get.mockReset();
    globalThis.fetch = realFetch;
  });

  it('never mints a Keycloak service token in production, even with DEV_KEYCLOAK_TOKEN=true', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('DEV_KEYCLOAK_TOKEN', 'true');
    cookieStore.get.mockReturnValue({ value: 'not-a-jwt' });
    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy as unknown as typeof fetch;

    const token = await getToken();

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(token).toBe('not-a-jwt');
  });
});
