import '@testing-library/jest-dom/vitest';
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DashboardTabs } from '../dashboard-tabs';

/**
 * v1.41 — the dashboard's three sections (Coverage / Cross-modality /
 * Activity) used to be a single long scroll with a sticky anchor sub-nav.
 * They are now real tabs: one panel visible at a time, switched by an
 * accessible tablist. These tests drive the tablist behavior in isolation
 * with simple text-node panels.
 */
function renderTabs() {
  return render(
    <DashboardTabs
      tabs={[
        { id: 'section-coverage', label: 'Coverage', content: <p>coverage panel body</p> },
        { id: 'section-cross-modality', label: 'Cross-modality', content: <p>cross-modality panel body</p> },
        { id: 'section-activity', label: 'Activity', content: <p>activity panel body</p> },
      ]}
    />,
  );
}

describe('DashboardTabs', () => {
  it('renders one tab per section in an accessible tablist', () => {
    renderTabs();
    const tablist = screen.getByRole('tablist', { name: 'Dashboard sections' });
    expect(tablist).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Coverage' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Cross-modality' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Activity' })).toBeInTheDocument();
  });

  it('selects the first tab (Coverage) by default and shows only its panel', () => {
    renderTabs();
    expect(screen.getByRole('tab', { name: 'Coverage' })).toHaveAttribute('aria-selected', 'true');
    // The active panel is visible; the others are `hidden` (so getByRole for
    // a tabpanel returns the active one only).
    expect(screen.getByText('coverage panel body')).toBeVisible();
    expect(screen.getByText('cross-modality panel body')).not.toBeVisible();
    expect(screen.getByText('activity panel body')).not.toBeVisible();
  });

  it('switches the visible panel when a tab is clicked', () => {
    renderTabs();
    fireEvent.click(screen.getByRole('tab', { name: 'Cross-modality' }));

    expect(screen.getByRole('tab', { name: 'Cross-modality' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Coverage' })).toHaveAttribute('aria-selected', 'false');
    expect(screen.getByText('cross-modality panel body')).toBeVisible();
    expect(screen.getByText('coverage panel body')).not.toBeVisible();
  });

  it('moves selection with Right/Left arrow keys (roving focus)', () => {
    renderTabs();
    const coverage = screen.getByRole('tab', { name: 'Coverage' });
    coverage.focus();

    fireEvent.keyDown(coverage, { key: 'ArrowRight' });
    expect(screen.getByRole('tab', { name: 'Cross-modality' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('cross-modality panel body')).toBeVisible();

    fireEvent.keyDown(screen.getByRole('tab', { name: 'Cross-modality' }), { key: 'ArrowLeft' });
    expect(screen.getByRole('tab', { name: 'Coverage' })).toHaveAttribute('aria-selected', 'true');
  });

  it('wraps from the last tab to the first with ArrowRight and supports Home/End', () => {
    renderTabs();
    const activity = screen.getByRole('tab', { name: 'Activity' });
    fireEvent.click(activity);
    expect(activity).toHaveAttribute('aria-selected', 'true');

    fireEvent.keyDown(activity, { key: 'ArrowRight' });
    expect(screen.getByRole('tab', { name: 'Coverage' })).toHaveAttribute('aria-selected', 'true');

    fireEvent.keyDown(screen.getByRole('tab', { name: 'Coverage' }), { key: 'End' });
    expect(screen.getByRole('tab', { name: 'Activity' })).toHaveAttribute('aria-selected', 'true');

    fireEvent.keyDown(screen.getByRole('tab', { name: 'Activity' }), { key: 'Home' });
    expect(screen.getByRole('tab', { name: 'Coverage' })).toHaveAttribute('aria-selected', 'true');
  });
});
