import { afterEach, describe, expect, it, vi } from 'vitest';

const isAdminMock = vi.fn();
const redirectMock = vi.fn();
vi.mock('@/lib/admin-guard', () => ({ isAdmin: () => isAdminMock() }));
vi.mock('next/navigation', () => ({ redirect: (url: string) => redirectMock(url) }));

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
