import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}));

describe('NewTemplatePage', () => {
  it('renders the wizard with a Create configuration button', async () => {
    const Page = (await import('../page')).default;
    const ui = await Page({ searchParams: Promise.resolve({}) });
    render(ui as React.ReactElement);
    expect(screen.getByLabelText(/audit name/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create configuration/i })).toBeInTheDocument();
  });

  it('uses the watcher heading and noun when ?observation_class=watcher', async () => {
    const Page = (await import('../page')).default;
    const ui = await Page({
      searchParams: Promise.resolve({ observation_class: 'watcher' }),
    });
    render(ui as React.ReactElement);
    expect(screen.getByRole('heading', { name: /new watch/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/watch name/i)).toBeInTheDocument();
  });
});
