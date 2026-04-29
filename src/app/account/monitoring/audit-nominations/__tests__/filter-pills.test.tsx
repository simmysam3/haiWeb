import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
  usePathname: () => '/account/monitoring/audit-nominations',
  useSearchParams: () => new URLSearchParams('status=outstanding'),
}));

import { FilterPills } from '../filter-pills';

describe('FilterPills', () => {
  it('renders status options reflecting current selection', () => {
    render(<FilterPills observers={[]} />);
    const outstanding = screen.getByRole('button', { name: /outstanding/i });
    expect(outstanding).toHaveAttribute('aria-pressed', 'true');
  });

  it('toggles a status filter via router.push with new search params', async () => {
    const user = userEvent.setup();
    render(<FilterPills observers={[]} />);
    await user.click(screen.getByRole('button', { name: /acknowledged/i }));
    expect(push).toHaveBeenCalledWith(
      expect.stringMatching(/status=outstanding.*status=acknowledged|status=acknowledged.*status=outstanding/),
    );
  });
});
