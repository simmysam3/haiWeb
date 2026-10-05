import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';

const isAdminMock = vi.fn();
const redirectMock = vi.fn();
vi.mock('@/lib/admin-guard', () => ({ isAdmin: () => isAdminMock() }));
vi.mock('next/navigation', () => ({ redirect: (url: string) => redirectMock(url) }));
vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
}));

import AdminLayout from '../layout';

afterEach(() => {
  isAdminMock.mockReset();
  redirectMock.mockReset();
});

describe('AdminLayout access gate', () => {
  it('redirects a non-admin session away from the admin console', async () => {
    isAdminMock.mockResolvedValue(false);
    await AdminLayout({ children: null });
    expect(redirectMock).toHaveBeenCalledWith('/account');
  });

  it('renders for an admin session without redirecting', async () => {
    isAdminMock.mockResolvedValue(true);
    await AdminLayout({ children: null });
    expect(redirectMock).not.toHaveBeenCalled();
  });
});

describe('AdminLayout nav — Help Conversations', () => {
  it('lists Help Conversations only when the help agent is enabled', async () => {
    isAdminMock.mockResolvedValue(true);
    const off = render(await AdminLayout({ children: null }));
    expect(screen.queryByRole('link', { name: 'Help Conversations' })).toBeNull();
    off.unmount();
    process.env.HELP_AGENT_ENABLED = 'true';
    try {
      render(await AdminLayout({ children: null }));
    } finally {
      delete process.env.HELP_AGENT_ENABLED;
    }
    expect(screen.getByRole('link', { name: 'Help Conversations' })).toHaveAttribute('href', '/admin/help');
  });

  it('adds Help Conversations after the existing entries and keeps them', async () => {
    isAdminMock.mockResolvedValue(true);
    process.env.HELP_AGENT_ENABLED = 'true';
    try {
      render(await AdminLayout({ children: null }));
    } finally {
      delete process.env.HELP_AGENT_ENABLED;
    }
    expect(screen.getByRole('link', { name: 'Feedback' })).toHaveAttribute('href', '/admin/feedback');
    const navLinks = within(screen.getByRole('navigation')).getAllByRole('link');
    expect(navLinks.at(-1)).toHaveTextContent('Help Conversations');
  });
});
