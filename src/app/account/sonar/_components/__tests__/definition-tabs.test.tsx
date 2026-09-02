import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DefinitionTabs } from '../definition-tabs';

/**
 * v1.85 — a definition page (watcher or audit) splits Run history from
 * Configuration. The
 * selected tab round-trips through `?tab=` so the list's "Edit configuration"
 * lands on the editor and the back button returns to the tab you left.
 */
const replace = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/account/sonar/watchers/definitions/t-1',
}));

beforeEach(() => replace.mockReset());

function renderTabs(initialTab: 'runs' | 'configuration') {
  return render(
    <DefinitionTabs
      ariaLabel="Watcher sections"
      initialTab={initialTab}
      runs={<p>runs slot</p>}
      configuration={<p>configuration slot</p>}
    />,
  );
}

describe('DefinitionTabs', () => {
  it('opens on Run history by default and hides the configuration slot', () => {
    renderTabs('runs');
    expect(screen.getByRole('tablist', { name: 'Watcher sections' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Run history' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('runs slot')).toBeVisible();
    expect(screen.getByText('configuration slot')).not.toBeVisible();
  });

  it('opens on Configuration when the URL asked for it', () => {
    renderTabs('configuration');
    expect(screen.getByRole('tab', { name: 'Configuration' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('configuration slot')).toBeVisible();
    expect(screen.getByText('runs slot')).not.toBeVisible();
  });

  it('writes the selected tab back to the URL without scrolling', () => {
    renderTabs('runs');
    fireEvent.click(screen.getByRole('tab', { name: 'Configuration' }));
    expect(replace).toHaveBeenCalledWith(
      '/account/sonar/watchers/definitions/t-1?tab=configuration',
      { scroll: false },
    );
  });
});
