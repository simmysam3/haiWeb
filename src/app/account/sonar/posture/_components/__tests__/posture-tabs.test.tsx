import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('next/navigation', () => ({
  usePathname: () => '/account/sonar/posture',
}));

import { PostureTabs } from '../posture-tabs';

describe('PostureTabs (v1.37 R2 — Coverage removed from Posture)', () => {
  it('renders the four workflow tabs in order: Working list, Changes, Obligations, Runs', () => {
    render(<PostureTabs hasScopes={true} />);
    const links = screen.getAllByRole('link');
    const labels = links.map((l) => l.textContent?.trim() ?? '');
    // Coverage MUST NOT appear — it lives at /sonar/dashboard post-R2.
    expect(labels.some((l) => /^Coverage$/.test(l))).toBe(false);
    // Strip any "Start here" badge text suffix.
    expect(labels[0]).toMatch(/^Working list/);
    expect(labels[1]).toMatch(/^Changes/);
    expect(labels[2]).toMatch(/^Obligations/);
    expect(labels[3]).toMatch(/^Runs/);
    expect(labels).toHaveLength(4);
  });

  it('does NOT render a tab labeled "Coverage"', () => {
    render(<PostureTabs hasScopes={true} />);
    expect(screen.queryByRole('link', { name: /^Coverage$/ })).toBeNull();
  });

  it('points the Working list tab at the bare /sonar/posture (section-root landing)', () => {
    render(<PostureTabs hasScopes={true} />);
    const wl = screen.getByRole('link', { name: /Working list/i });
    expect(wl).toHaveAttribute('href', '/account/sonar/posture');
  });

  it('renders the "Start here" badge on Working list when no scopes', () => {
    render(<PostureTabs hasScopes={false} />);
    expect(screen.getByText(/Start here/i)).toBeInTheDocument();
    // Should be inside the Working list link.
    const wl = screen.getByRole('link', { name: /Working list/i });
    expect(wl.textContent).toMatch(/Start here/);
  });
});
