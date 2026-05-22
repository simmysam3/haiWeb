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

// swr mock — RequestManagementNavItem uses useSWR to poll counts; return no
// data so the link renders in its idle state (no badge, no error indicator).
vi.mock('swr', () => ({
  default: () => ({ data: undefined, error: undefined }),
}));

describe('AccountNav', () => {
  // v1.39: single Sonar section split into Sonar Audit + Sonar Observe.

  it('Sonar Audit section contains only the Audits link', () => {
    render(<AccountNav userName="Test User" userEmail="test@example.com" />);
    const audits = screen.getByRole('link', { name: 'Audits' });
    expect(audits.getAttribute('href')).toBe('/account/sonar/audit');
  });

  it('Sonar Observe section contains Dashboard, Request Management, Posture, Observations, Configurations', () => {
    render(<AccountNav userName="Test User" userEmail="test@example.com" />);

    const dashboard = screen.getByRole('link', { name: 'Sonar Dashboard' });
    expect(dashboard.getAttribute('href')).toBe('/account/sonar/dashboard');

    const requests = screen.getByRole('link', { name: 'Request Management' });
    expect(requests.getAttribute('href')).toBe('/account/sonar/requests');

    const posture = screen.getByRole('link', { name: 'Posture' });
    expect(posture.getAttribute('href')).toBe('/account/sonar/posture');

    const observations = screen.getByRole('link', { name: 'Observations' });
    expect(observations.getAttribute('href')).toBe('/account/sonar/observations');

    const configurations = screen.getByRole('link', { name: 'Configurations' });
    expect(configurations.getAttribute('href')).toBe('/account/sonar/templates');
  });

  it('Reports link is not present in the nav (dropped in v1.39)', () => {
    render(<AccountNav userName="Test User" userEmail="test@example.com" />);
    expect(screen.queryByRole('link', { name: 'Reports' })).toBeNull();
  });

  it('Monitoring section no longer surfaces the pre-Sonar Audit Nominations entry', () => {
    render(<AccountNav userName="Test User" userEmail="test@example.com" />);
    const audit = screen.queryAllByRole('link', { name: 'Audit Nominations' });
    expect(audit).toHaveLength(0);
  });
});
