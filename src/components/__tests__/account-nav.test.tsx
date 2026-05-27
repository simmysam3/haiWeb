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

  it('Sonar Audit section contains Audit Management + Event Backlog', () => {
    render(<AccountNav userName="Test User" userEmail="test@example.com" />);
    const audits = screen.getByRole('link', { name: 'Audit Management' });
    expect(audits.getAttribute('href')).toBe('/account/sonar/audit');

    // v.1.43: "Watcher Backlog" was relocated from Sonar Observe to Sonar
    // Audit and renamed "Event Backlog" — it's an audit-data workflow, not
    // a watcher one. Default landing is the Events tab.
    const eventBacklog = screen.getByRole('link', { name: 'Event Backlog' });
    expect(eventBacklog.getAttribute('href')).toBe('/account/sonar/audit/events');
  });

  it('Sonar Observe section no longer carries Watcher Backlog (moved to Audit)', () => {
    render(<AccountNav userName="Test User" userEmail="test@example.com" />);

    const dashboard = screen.getByRole('link', { name: 'Sonar Dashboard' });
    expect(dashboard.getAttribute('href')).toBe('/account/sonar/dashboard');

    const requests = screen.getByRole('link', { name: 'Request Management' });
    expect(requests.getAttribute('href')).toBe('/account/sonar/requests');

    // v.1.43: Watcher Backlog moved out of Observe.
    expect(screen.queryByRole('link', { name: 'Watcher Backlog' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Posture' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Backlog' })).toBeNull();

    const phantomDemand = screen.getByRole('link', { name: 'Phantom Demand' });
    expect(phantomDemand.getAttribute('href')).toBe('/account/sonar/observations');

    expect(screen.queryByRole('link', { name: 'Configurations' })).toBeNull();

    const watcherMgmt = screen.getByRole('link', { name: 'Watcher Management' });
    expect(watcherMgmt.getAttribute('href')).toBe('/account/sonar/watchers');
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
