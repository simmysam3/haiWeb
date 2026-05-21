import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
  usePathname: () => '/account/sonar/posture/obligations',
  useSearchParams: () => new URLSearchParams('resolution_class=pending'),
}));

import { FilterPills } from '../filter-pills';

describe('FilterPills', () => {
  it('renders resolution_class options reflecting current selection', () => {
    render(<FilterPills />);
    const pending = screen.getByRole('button', { name: /^pending$/i });
    expect(pending).toHaveAttribute('aria-pressed', 'true');
  });

  it('toggles a resolution filter via router.push with new search params', async () => {
    const user = userEvent.setup();
    render(<FilterPills />);
    await user.click(screen.getByRole('button', { name: /^agentic_eligible$/i }));
    expect(push).toHaveBeenCalledWith(
      expect.stringMatching(/resolution_class=pending.*resolution_class=agentic_eligible|resolution_class=agentic_eligible.*resolution_class=pending/),
    );
  });

  it('renders network status pills', () => {
    render(<FilterPills />);
    expect(screen.getByRole('button', { name: /^participant$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^invited$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^not_invited$/i })).toBeInTheDocument();
  });
});
