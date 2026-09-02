import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SectionTabs } from '../section-tabs';

/**
 * v1.85 — `SectionTabs` is the accessible tablist previously private to the
 * Sonar dashboard, promoted so the watcher definition page can use it. Two
 * additions over the dashboard original: the initially-selected tab can be
 * chosen by the caller (a `?tab=` deep link), and the caller is told when the
 * selection changes (so it can write the URL back).
 */
const TABS = [
  { id: 'runs', label: 'Run history', content: <p>runs panel body</p> },
  { id: 'configuration', label: 'Configuration', content: <p>configuration panel body</p> },
];

describe('SectionTabs', () => {
  it('renders an accessible tablist named by ariaLabel and selects the first tab by default', () => {
    render(<SectionTabs ariaLabel="Watcher sections" tabs={TABS} />);
    expect(screen.getByRole('tablist', { name: 'Watcher sections' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Run history' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('runs panel body')).toBeVisible();
    expect(screen.getByText('configuration panel body')).not.toBeVisible();
  });

  it('selects the tab named by initialId on first render', () => {
    render(<SectionTabs ariaLabel="Watcher sections" tabs={TABS} initialId="configuration" />);
    expect(screen.getByRole('tab', { name: 'Configuration' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('configuration panel body')).toBeVisible();
    expect(screen.getByText('runs panel body')).not.toBeVisible();
  });

  it('falls back to the first tab when initialId names no tab', () => {
    render(<SectionTabs ariaLabel="Watcher sections" tabs={TABS} initialId="nope" />);
    expect(screen.getByRole('tab', { name: 'Run history' })).toHaveAttribute('aria-selected', 'true');
  });

  it('reports the newly selected tab id through onChange on click', () => {
    const onChange = vi.fn();
    render(<SectionTabs ariaLabel="Watcher sections" tabs={TABS} onChange={onChange} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Configuration' }));
    expect(onChange).toHaveBeenCalledWith('configuration');
    expect(screen.getByText('configuration panel body')).toBeVisible();
  });

  it('reports arrow-key selection changes through onChange too', () => {
    const onChange = vi.fn();
    render(<SectionTabs ariaLabel="Watcher sections" tabs={TABS} onChange={onChange} />);
    fireEvent.keyDown(screen.getByRole('tab', { name: 'Run history' }), { key: 'ArrowRight' });
    expect(onChange).toHaveBeenCalledWith('configuration');
  });
});
