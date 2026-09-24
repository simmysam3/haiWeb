/// <reference types="vitest/jsdom" />
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { sessionFor } from '@/test/role-gate';

// The theme root reads localStorage. Node 26's own (file-less, undefined) localStorage global
// shadows jsdom's: vitest 4.1.4's populateGlobal skips a key already on global unless it is
// in its KEYS list. Use jsdom's.
vi.stubGlobal('localStorage', jsdom.window.localStorage);

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

  it('renders the app inside the theme root (dark by default)', async () => {
    getSession.mockResolvedValue(sessionFor('account_admin'));
    const { default: Layout } = await import('../layout');
    render(await Layout({ children: <p>inside</p> }));
    expect(screen.getByTestId('sm-root')).toHaveAttribute('data-theme', 'dark');
    expect(screen.getByTestId('sm-root')).toContainElement(screen.getByText('inside'));
  });
});
