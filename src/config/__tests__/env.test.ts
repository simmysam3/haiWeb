import { describe, it, expect } from 'vitest';
import { loadEnv } from '../env';

describe('haiWeb server env', () => {
  it('loads + validates haiWeb server env with defaults', () => {
    const env = loadEnv();
    expect(env.HAIWAVE_API_URL).toMatch(/^https?:\/\//);
    expect(env.KEYCLOAK_REALM).toBeTruthy();
  });

  it('throws on the dev-default SESSION_SECRET in production', () => {
    const prev = { ...process.env };
    const mutable = process.env as Record<string, string | undefined>;
    mutable.NODE_ENV = 'production';
    delete mutable.SESSION_SECRET;
    expect(() => loadEnv()).toThrow(/SESSION_SECRET/);
    process.env = prev as NodeJS.ProcessEnv;
  });
});
