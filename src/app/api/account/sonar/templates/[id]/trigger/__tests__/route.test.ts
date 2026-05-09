import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const triggerRunTemplate = vi.fn();
vi.mock('@/lib/with-hai-core', () => ({
  withHaiCore: (handler: (ctx: unknown) => unknown) =>
    async (request: NextRequest, routeCtx: { params: Promise<{ id: string }> }) => {
      const client = { triggerRunTemplate };
      return handler({
        client,
        request,
        session: { user: { id: 'u-1' } },
        params: await routeCtx.params,
      });
    },
}));

beforeEach(() => triggerRunTemplate.mockReset());

describe('POST /api/account/sonar/templates/[id]/trigger', () => {
  it('returns the run id from triggerRunTemplate', async () => {
    triggerRunTemplate.mockResolvedValue({ run_id: 'run-xyz' });
    const { POST } = await import('../route');
    const res = await POST(
      new NextRequest('http://localhost/api/account/sonar/templates/abc/trigger', {
        method: 'POST',
      }),
      { params: Promise.resolve({ id: 'abc' }) },
    );
    expect(await res.json()).toEqual({ run_id: 'run-xyz' });
    expect(triggerRunTemplate).toHaveBeenCalledWith('abc');
  });
});
