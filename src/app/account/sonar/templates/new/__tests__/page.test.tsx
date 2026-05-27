import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

const redirectMock = vi.fn((url: string) => {
  // Mirror next/navigation: redirect() throws a sentinel error so the
  // component aborts. Tests catch + inspect the captured URL.
  throw new Error(`__NEXT_REDIRECT__:${url}`);
});

vi.mock('next/navigation', () => ({
  redirect: redirectMock,
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}));

beforeEach(() => {
  redirectMock.mockClear();
});

describe('NewTemplatePage', () => {
  it('renders the wizard with a Create configuration button (no class param)', async () => {
    const Page = (await import('../page')).default;
    const ui = await Page({ searchParams: Promise.resolve({}) });
    render(ui as React.ReactElement);
    expect(screen.getByRole('button', { name: /create configuration/i })).toBeInTheDocument();
  });

  it('redirects /templates/new?observation_class=watcher → /account/sonar/watchers/new (v.1.43 Plan 2)', async () => {
    const Page = (await import('../page')).default;
    await expect(
      Page({ searchParams: Promise.resolve({ observation_class: 'watcher' }) }),
    ).rejects.toThrow(/__NEXT_REDIRECT__/);
    expect(redirectMock).toHaveBeenCalledWith('/account/sonar/watchers/new');
  });
});
