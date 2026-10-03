import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RISK_STATUS_PILLS, ACTIVE_RISK_STATUSES } from '@/lib/sourcing-map/backlogs';

const push = vi.hoisted(() => vi.fn());
let search = '';
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
  usePathname: () => '/account/sonar/supply-risks',
  useSearchParams: () => new URLSearchParams(search),
}));

import { BacklogPills } from '../backlog-pills';

describe('BacklogPills', () => {
  beforeEach(() => {
    push.mockClear();
    search = '';
  });

  it('presses the resolved active list, not the raw URL', () => {
    render(<BacklogPills param="status" pills={RISK_STATUS_PILLS} active={ACTIVE_RISK_STATUSES} />);
    expect(screen.getByRole('button', { name: 'Open' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Resolved' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('a click toggles from the resolved list and drops the cursor', () => {
    search = 'cursor=c1';
    render(<BacklogPills param="status" pills={RISK_STATUS_PILLS} active={ACTIVE_RISK_STATUSES} />);
    fireEvent.click(screen.getByRole('button', { name: 'Resolved' }));
    expect(push).toHaveBeenCalledWith('/account/sonar/supply-risks?status=open&status=contacted&status=resolving&status=resolved');
  });

  it('un-presses a pressed value', () => {
    render(<BacklogPills param="status" pills={RISK_STATUS_PILLS} active={ACTIVE_RISK_STATUSES} />);
    fireEvent.click(screen.getByRole('button', { name: 'Contacted' }));
    expect(push).toHaveBeenCalledWith('/account/sonar/supply-risks?status=open&status=resolving');
  });

  it('renders no Pill inside a button and no title', () => {
    render(<BacklogPills param="status" pills={RISK_STATUS_PILLS} active={ACTIVE_RISK_STATUSES} />);
    for (const b of screen.getAllByRole('button')) {
      expect(b.querySelector('[data-testid="pill"]')).toBeNull();
      expect(b).not.toHaveAttribute('title');
    }
  });
});
