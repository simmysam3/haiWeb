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

  it('Sonar Observe section carries Watcher Backlog (drift events) alongside the watcher / phantom / requests entries', () => {
    render(<AccountNav userName="Test User" userEmail="test@example.com" />);

    const dashboard = screen.getByRole('link', { name: 'Sonar Dashboard' });
    expect(dashboard.getAttribute('href')).toBe('/account/sonar/dashboard');

    const requests = screen.getByRole('link', { name: 'Request Management' });
    expect(requests.getAttribute('href')).toBe('/account/sonar/requests');

    // v.1.43: the original Backlog forked into two surfaces filtering the
    // same compliance_changes feed by source_kind. Watcher Backlog stays
    // under Sonar Observe (lead_time_degraded / lead_time_improved from
    // scheduled watcher runs); the audit-data Event Backlog moved to
    // Sonar Audit (asserted above).
    const watcherBacklog = screen.getByRole('link', { name: 'Watcher Backlog' });
    expect(watcherBacklog.getAttribute('href')).toBe('/account/sonar/posture/changes');
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

  it('shows the Agent Software link in the bottom nav section', () => {
    render(<AccountNav userName="Test User" userEmail="test@example.com" />);
    const link = screen.getByRole('link', { name: 'Agent Software' });
    expect(link.getAttribute('href')).toBe('/account/agent-software');
  });

  // The "Agent Software" section was renamed "Agents" and now consolidates all
  // agent management: Agent Health + Agent Software + the provisioning page
  // (relabeled from "Agents" to "Agent Provisioning"). "Agents" is a section
  // heading now, not a link.
  it('Agents section groups Agent Health, Agent Software, and Agent Provisioning', () => {
    const { container } = render(<AccountNav userName="Test User" userEmail="test@example.com" />);

    const provisioning = screen.getByRole('link', { name: 'Agent Provisioning' });
    expect(provisioning.getAttribute('href')).toBe('/account/agents');

    // the bare "Agents" nav link is gone — it's a section heading now
    expect(screen.queryByRole('link', { name: 'Agents' })).toBeNull();

    // all three agent links live under the same "Agents" section heading
    const sections = Array.from(container.querySelectorAll('nav > div'));
    const agentsSection = sections.find((s) => s.textContent?.trimStart().startsWith('Agents'));
    expect(agentsSection).toBeTruthy();
    const hrefs = Array.from(agentsSection!.querySelectorAll('a')).map((a) => a.getAttribute('href'));
    expect(hrefs).toEqual(
      expect.arrayContaining(['/account/agent-health', '/account/agent-software', '/account/agents']),
    );
  });

  // v.1.58: the "Settings" section was dissolved — Trust Posture moves under
  // Account Management and Sign-in & Security under Admin.
  it('dissolves Settings: Trust Posture under Account Management, Sign-in & Security under Admin', () => {
    const { container } = render(<AccountNav userName="Test User" userEmail="test@example.com" />);
    const sections = Array.from(container.querySelectorAll('nav > div'));

    // no "Settings" section heading remains
    expect(sections.some((s) => s.textContent?.trimStart().startsWith('Settings'))).toBe(false);

    const sectionHrefs = (prefix: string) => {
      const section = sections.find((s) => s.textContent?.trimStart().startsWith(prefix));
      expect(section).toBeTruthy();
      return Array.from(section!.querySelectorAll('a')).map((a) => a.getAttribute('href'));
    };

    expect(sectionHrefs('Account Management')).toContain('/account/settings/trust-posture');
    expect(sectionHrefs('Admin')).toContain('/account/security');
  });

  // Regression: Sign Out must NOT be a <Link>/<a> to the logout route. Next's
  // router prefetches visible <Link>s on navigation, and a prefetch of a
  // GET-mutating logout route silently destroys the session → the user is
  // bounced to re-login when merely moving between pages. Logout is a
  // mutation and must be a POST form (forms are never prefetched).
  it('renders Sign Out as a POST form, never a prefetchable logout link', () => {
    render(<AccountNav userName="Test User" userEmail="test@example.com" />);
    // No anchor to the logout route (a <Link> would be prefetched by Next).
    expect(screen.queryByRole('link', { name: /sign out/i })).toBeNull();
    // It is a submit button inside a POST form targeting the logout route.
    const button = screen.getByRole('button', { name: /sign out/i });
    const form = button.closest('form');
    expect(form).not.toBeNull();
    expect(form?.getAttribute('action')).toBe('/api/auth/logout');
    expect((form?.getAttribute('method') ?? '').toLowerCase()).toBe('post');
  });
});
