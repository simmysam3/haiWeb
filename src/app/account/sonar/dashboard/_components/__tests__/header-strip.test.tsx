import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

import { HeaderStrip } from '../header-strip';

describe('HeaderStrip', () => {
  it('renders all 4 tiles with full data', () => {
    render(
      <HeaderStrip
        totalPartners={5}
        lastRunAt="2026-05-09T03:00:00Z"
        throttledCounts={{ audit: 0, watcher: 0, total: 0 }}
        failedRunsLast30d={2}
      />,
    );
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText(/Total partners observed/i)).toBeInTheDocument();
    expect(screen.getByText(/Failed runs/i)).toBeInTheDocument();
  });

  it('links to the Configurations list view (only inbound UI path to /account/sonar/templates)', () => {
    render(
      <HeaderStrip
        totalPartners={1}
        lastRunAt={null}
        throttledCounts={null}
        failedRunsLast30d={null}
        enabledTemplateCount={3}
      />,
    );
    const link = screen.getByRole('link', { name: /configurations/i });
    expect(link).toHaveAttribute('href', '/account/sonar/templates');
  });

  it('renders dash for null tiles', () => {
    render(
      <HeaderStrip
        totalPartners={0}
        lastRunAt={null}
        throttledCounts={null}
        failedRunsLast30d={null}
      />,
    );
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
    expect(screen.getByText(/Never/i)).toBeInTheDocument();
  });
});
