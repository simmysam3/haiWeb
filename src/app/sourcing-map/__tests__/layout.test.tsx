import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { sessionFor } from '@/test/role-gate';
import { SmHeader } from '../_components/sm-header';

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
const { fetchBffJson } = vi.hoisted(() => ({ fetchBffJson: vi.fn() }));
vi.mock('@/lib/server-fetch', () => ({ fetchBffJson }));
// next/link renders an <a>, next/image nothing, so the header can render inside the layout
vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
}));
vi.mock('next/image', () => ({ default: () => null }));

beforeEach(() => {
  getSession.mockReset();
  forbiddenMock.mockClear();
  fetchBffJson.mockReset();
  fetchBffJson.mockResolvedValue({ kind: 'error', status: 500, message: 'x' });
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

  it('reads the open count once, after the role check, and the header inside shows it', async () => {
    getSession.mockResolvedValue(sessionFor('account_admin'));
    fetchBffJson.mockResolvedValue({ kind: 'ok', data: { items: [], open_count: 3 } });
    const { default: Layout } = await import('../layout');
    render(await Layout({ children: <SmHeader crumbs={[{ label: 'Projects' }]} /> }));
    expect(screen.getByRole('link', { name: 'Supply Risks (3 open)' })).toBeInTheDocument();
    expect(fetchBffJson).toHaveBeenCalledTimes(1);
    expect(fetchBffJson.mock.calls[0][0]).toMatch(/^\/api\/account\/sourcing-map\/supply-risks/);
  });

  it.each([
    ['an error answer', { kind: 'error', status: 500, message: 'x' }],
    ['a non-integer open_count', { kind: 'ok', data: { items: [], open_count: '3' } }],
  ])('shows the plain link on %s, never "(0 open)"', async (_name, answer) => {
    getSession.mockResolvedValue(sessionFor('account_admin'));
    fetchBffJson.mockResolvedValue(answer);
    const { default: Layout } = await import('../layout');
    render(await Layout({ children: <SmHeader crumbs={[{ label: 'Projects' }]} /> }));
    expect(screen.getByRole('link', { name: 'Supply Risks' })).toBeInTheDocument();
  });

  it('never reads the count for a role that is forbidden', async () => {
    getSession.mockResolvedValue(sessionFor('buyer_view_only'));
    const { default: Layout } = await import('../layout');
    await expect(Layout({ children: <p>inside</p> })).rejects.toThrow('__NEXT_FORBIDDEN__');
    expect(fetchBffJson).not.toHaveBeenCalled();
  });
});
