import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}));

describe('NewTemplatePage', () => {
  it('renders the template form', async () => {
    const Page = (await import('../page')).default;
    const ui = await Page({ searchParams: Promise.resolve({}) });
    render(ui as React.ReactElement);
    expect(screen.getByLabelText(/template name/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create template/i })).toBeInTheDocument();
  });

  it('preselects watcher modality when ?observation_class=watcher', async () => {
    const Page = (await import('../page')).default;
    const ui = await Page({
      searchParams: Promise.resolve({ observation_class: 'watcher' }),
    });
    render(ui as React.ReactElement);
    expect(screen.getByLabelText(/lead time distribution/i)).toBeInTheDocument();
  });
});
