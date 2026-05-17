import { describe, it, expect } from 'vitest';
import { describeApiError } from '../api-error';

function res(body: unknown, status: number, contentType = 'application/json'): Response {
  const init: ResponseInit = { status, headers: { 'content-type': contentType } };
  if (typeof body === 'string' && contentType !== 'application/json') {
    return new Response(body, init);
  }
  return new Response(JSON.stringify(body), init);
}

describe('describeApiError', () => {
  it('surfaces a haiCore validation envelope with field path detail', async () => {
    const r = res(
      {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid create template request (1 validation error(s))',
          details: [{ path: ['scope', 'provenance_key_id'], message: 'Invalid uuid' }],
        },
      },
      400,
    );
    const info = await describeApiError(r);
    expect(info.status).toBe(400);
    expect(info.sessionExpired).toBe(false);
    expect(info.message).toContain('Invalid create template request');
    expect(info.message).toContain('scope.provenance_key_id');
    expect(info.message).toContain('Invalid uuid');
  });

  it('always reports 401 as an expired session regardless of body', async () => {
    const r = res({ error: 'Unauthorized' }, 401);
    const info = await describeApiError(r);
    expect(info.sessionExpired).toBe(true);
    expect(info.status).toBe(401);
    expect(info.message.toLowerCase()).toContain('session');
    expect(info.message.toLowerCase()).toContain('sign in');
  });

  it('handles a plain string error envelope', async () => {
    const info = await describeApiError(res({ error: 'No token' }, 500));
    expect(info.sessionExpired).toBe(false);
    expect(info.message).toBe('No token');
  });

  it('gives a permission message for 403 with no usable body', async () => {
    const info = await describeApiError(res({}, 403));
    expect(info.message.toLowerCase()).toContain('permission');
  });

  it('falls back gracefully on a non-JSON body', async () => {
    const info = await describeApiError(res('<html>502</html>', 502, 'text/html'));
    expect(info.status).toBe(502);
    expect(info.message).toContain('502');
  });

  it('summarizes at most three zod issues', async () => {
    const details = Array.from({ length: 6 }, (_, i) => ({
      path: ['f', String(i)],
      message: 'bad',
    }));
    const info = await describeApiError(
      res({ error: { code: 'VALIDATION_ERROR', message: 'Invalid', details } }, 400),
    );
    expect(info.message.match(/f\.\d: bad/g)?.length).toBe(3);
  });
});
