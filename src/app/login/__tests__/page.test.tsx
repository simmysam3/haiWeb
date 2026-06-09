import { describe, it, expect, vi, beforeEach } from 'vitest';

const redirect = vi.fn();
vi.mock('next/navigation', () => ({ redirect: (...a: unknown[]) => redirect(...a) }));

import LoginPage from '../page';

describe('LoginPage', () => {
  beforeEach(() => redirect.mockClear());

  it('redirects to /api/auth/login instead of rendering a card', async () => {
    await LoginPage({ searchParams: Promise.resolve({}) } as never);
    expect(redirect).toHaveBeenCalledWith('/api/auth/login');
  });

  it('forwards a ?next= destination to the OIDC start route', async () => {
    await LoginPage({ searchParams: Promise.resolve({ next: '/account/billing' }) } as never);
    expect(redirect).toHaveBeenCalledWith(
      '/api/auth/login?next=' + encodeURIComponent('/account/billing'),
    );
  });

  it('renders an error page (no OIDC redirect) when ?error= is present', async () => {
    // A failed callback bounces back here with ?error=. Re-entering the OIDC
    // flow would loop, so we must NOT redirect — we render an actionable error.
    const r = await LoginPage({
      searchParams: Promise.resolve({ error: 'exchange' }),
    } as never);
    expect(redirect).not.toHaveBeenCalled();
    expect(r).toBeTruthy();
  });
});
