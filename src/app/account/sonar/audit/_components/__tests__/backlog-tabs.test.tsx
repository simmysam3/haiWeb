import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('next/navigation', () => ({
  usePathname: () => '/account/sonar/audit/events',
}));

import { BacklogTabs } from '../backlog-tabs';

describe('BacklogTabs (Event Backlog — three audit-section tabs)', () => {
  it('renders the three mode tabs in order: Events, Gaps, Obligations', () => {
    render(<BacklogTabs hasScopes={true} />);
    const links = screen.getAllByRole('link');
    const labels = links.map((l) => l.textContent?.trim() ?? '');
    expect(labels[0]).toMatch(/^Events/);
    expect(labels[1]).toMatch(/^Gaps/);
    expect(labels[2]).toMatch(/^Obligations/);
    expect(labels).toHaveLength(3);
  });

  it('does NOT render the dropped Working list or Watchers tabs', () => {
    render(<BacklogTabs hasScopes={true} />);
    expect(screen.queryByRole('link', { name: /^Working list/i })).toBeNull();
    expect(screen.queryByRole('link', { name: /^Watchers/i })).toBeNull();
  });

  it('does NOT render a tab labeled "Coverage"', () => {
    render(<BacklogTabs hasScopes={true} />);
    expect(screen.queryByRole('link', { name: /^Coverage$/ })).toBeNull();
  });

  it('points the Events tab at /sonar/audit/events', () => {
    render(<BacklogTabs hasScopes={true} />);
    const events = screen.getByRole('link', { name: /^Events/i });
    expect(events).toHaveAttribute('href', '/account/sonar/audit/events');
  });

  it('points the Gaps tab at /sonar/audit/gaps', () => {
    render(<BacklogTabs hasScopes={true} />);
    const gaps = screen.getByRole('link', { name: /^Gaps/i });
    expect(gaps).toHaveAttribute('href', '/account/sonar/audit/gaps');
  });

  it('renders the "Start here" badge on Gaps when no scopes', () => {
    render(<BacklogTabs hasScopes={false} />);
    expect(screen.getByText(/Start here/i)).toBeInTheDocument();
    const gaps = screen.getByRole('link', { name: /Gaps/i });
    expect(gaps.textContent).toMatch(/Start here/);
  });
});
