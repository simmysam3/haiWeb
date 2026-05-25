import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('next/navigation', () => ({
  usePathname: () => '/account/sonar/posture',
}));

import { BacklogTabs } from '../backlog-tabs';

describe('BacklogTabs (v.1.41 Backlog IA — mode switching)', () => {
  it('renders the three mode tabs in order: Events, Gaps, Obligations', () => {
    render(<BacklogTabs hasScopes={true} />);
    const links = screen.getAllByRole('link');
    const labels = links.map((l) => l.textContent?.trim() ?? '');
    // Strip any "Start here" badge text suffix.
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

  it('does NOT render a tab labeled "Coverage" (v1.37 R2 carryover)', () => {
    render(<BacklogTabs hasScopes={true} />);
    expect(screen.queryByRole('link', { name: /^Coverage$/ })).toBeNull();
  });

  it('points the Events tab at the canonical /sonar/posture/changes URL', () => {
    // Section root /sonar/posture also renders Events (default landing
    // via posture/page.tsx re-exporting ChangesPage), but the tab href
    // is the canonical /changes path so deep-links and bookmarks
    // resolve consistently.
    render(<BacklogTabs hasScopes={true} />);
    const events = screen.getByRole('link', { name: /^Events/i });
    expect(events).toHaveAttribute('href', '/account/sonar/posture/changes');
  });

  it('points the Gaps tab at /sonar/posture/working-list (canonical Gaps URL)', () => {
    render(<BacklogTabs hasScopes={true} />);
    const gaps = screen.getByRole('link', { name: /^Gaps/i });
    expect(gaps).toHaveAttribute('href', '/account/sonar/posture/working-list');
  });

  it('renders the "Start here" badge on Gaps when no scopes', () => {
    // Start-here anchors the first-run setup CTA on the working-list-
    // derived surface (Gaps), not on the default Events landing.
    render(<BacklogTabs hasScopes={false} />);
    expect(screen.getByText(/Start here/i)).toBeInTheDocument();
    const gaps = screen.getByRole('link', { name: /Gaps/i });
    expect(gaps.textContent).toMatch(/Start here/);
  });
});
