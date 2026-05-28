import { describe, it, expect, vi, beforeEach } from 'vitest';

const getSessionMock = vi.fn();
vi.mock('../auth', () => ({
  getSession: () => getSessionMock(),
}));

import { requireAdmin, isAdmin } from '../admin-guard';

describe('isAdmin', () => {
  beforeEach(() => {
    getSessionMock.mockReset();
  });

  it('returns false when no session', async () => {
    getSessionMock.mockResolvedValue(null);
    expect(await isAdmin()).toBe(false);
  });

  it('returns false when session.is_admin is false', async () => {
    getSessionMock.mockResolvedValue({ is_admin: false, user: {}, participant: {} });
    expect(await isAdmin()).toBe(false);
  });

  it('returns true when session.is_admin is true', async () => {
    getSessionMock.mockResolvedValue({ is_admin: true, user: {}, participant: {} });
    expect(await isAdmin()).toBe(true);
  });
});

describe('requireAdmin', () => {
  beforeEach(() => {
    getSessionMock.mockReset();
  });

  it('throws 403 Response when not admin', async () => {
    getSessionMock.mockResolvedValue({ is_admin: false, user: {}, participant: {} });
    await expect(requireAdmin()).rejects.toMatchObject({ status: 403 });
  });

  it('resolves when admin', async () => {
    getSessionMock.mockResolvedValue({ is_admin: true, user: {}, participant: {} });
    await expect(requireAdmin()).resolves.toBeUndefined();
  });

  it('throws 403 Response when no session', async () => {
    getSessionMock.mockResolvedValue(null);
    await expect(requireAdmin()).rejects.toMatchObject({ status: 403 });
  });
});
