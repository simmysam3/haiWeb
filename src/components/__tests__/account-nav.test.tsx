import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AccountNav } from '../account-nav';

// next/navigation is used by AccountNav for usePathname
vi.mock('next/navigation', () => ({
  usePathname: () => '/',
}));

// next/image mocked so JSDOM doesn't choke on Image
vi.mock('next/image', () => ({
  default: ({ alt }: { alt: string }) => <img alt={alt} />,
}));

// next/link renders an <a> in tests
vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [k: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

describe('AccountNav', () => {
  it('Sonar section is consolidated to Sonar Dashboard + Observations', () => {
    render(<AccountNav userName="Test User" userEmail="test@example.com" />);
    const dashboard = screen.getByRole('link', { name: 'Sonar Dashboard' });
    expect(dashboard.getAttribute('href')).toBe('/account/sonar/dashboard');
    const observations = screen.getByRole('link', { name: 'Observations' });
    expect(observations.getAttribute('href')).toBe('/account/sonar/observations');
    // The pre-consolidation entries should no longer be present in the sidebar.
    expect(screen.queryByRole('link', { name: 'Phantom Demand' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Audit Dashboard' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Run Templates' })).toBeNull();
  });

  it('Monitoring section no longer surfaces the pre-Sonar Audit Nominations entry', () => {
    render(<AccountNav userName="Test User" userEmail="test@example.com" />);
    const audit = screen.queryAllByRole('link', { name: 'Audit Nominations' });
    expect(audit).toHaveLength(0);
  });
});
