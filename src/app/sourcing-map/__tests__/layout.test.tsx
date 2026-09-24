import { describe, it, expect, vi, beforeEach } from 'vitest';
import { sessionFor } from '@/test/role-gate';

const { getSession, forbiddenMock } = vi.hoisted(() => ({
  getSession: vi.fn(),
  forbiddenMock: vi.fn(() => {
    throw new Error('__NEXT_FORBIDDEN__');
  }),
}));
vi.mock('@/lib/auth', async () => {
  const actual = await vi.importActual<typeof import('@/lib/auth')>('@/lib/auth');
  return { ...actual, getSession };
});
vi.mock('next/navigation', () => ({ forbidden: forbiddenMock }));

beforeEach(() => {
  getSession.mockReset();
  forbiddenMock.mockClear();
});

describe('SourcingMapLayout', () => {
  it('answers 403 (forbidden) to a role outside the account_admin family (AC 1)', async () => {
    getSession.mockResolvedValue(sessionFor('buyer_view_only'));
    const { default: Layout } = await import('../layout');
    await expect(Layout({ children: <p>inside</p> })).rejects.toThrow('__NEXT_FORBIDDEN__');
  });
});
