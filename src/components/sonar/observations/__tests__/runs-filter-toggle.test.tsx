import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RunsFilterToggle } from '../runs-filter-toggle';
import { parseRunsFilter } from '../runs-filter';

/**
 * v1.85 (D-206) — Active | Archived toggle for a definition page's Run
 * history tab. Archived runs (template deleted with runs=archive) are
 * hidden from the default list; `?runs=archived` shows them instead.
 */
const replace = vi.fn();
let currentSearch = 'tab=runs';
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, push: vi.fn() }),
  usePathname: () => '/account/sonar/watchers',
  useSearchParams: () => new URLSearchParams(currentSearch),
}));

beforeEach(() => {
  replace.mockReset();
  currentSearch = 'tab=runs';
});

describe('RunsFilterToggle', () => {
  it('renders both radios in a labeled radiogroup', () => {
    render(<RunsFilterToggle value="active" />);
    expect(screen.getByRole('radiogroup', { name: 'Runs' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Active' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Archived' })).toBeInTheDocument();
  });

  it('checks Archived when value="archived"', () => {
    render(<RunsFilterToggle value="archived" />);
    expect(screen.getByRole('radio', { name: 'Archived' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Active' })).not.toBeChecked();
  });

  it('checks Active when value="active"', () => {
    render(<RunsFilterToggle value="active" />);
    expect(screen.getByRole('radio', { name: 'Active' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Archived' })).not.toBeChecked();
  });

  it('clicking Archived preserves other params and sets runs=archived via replace', () => {
    render(<RunsFilterToggle value="active" />);
    fireEvent.click(screen.getByRole('radio', { name: 'Archived' }));
    expect(replace).toHaveBeenCalledWith(
      '/account/sonar/watchers?tab=runs&runs=archived',
      { scroll: false },
    );
  });

  it('clicking Active removes runs and keeps other params via replace', () => {
    currentSearch = 'tab=runs&runs=archived';
    render(<RunsFilterToggle value="archived" />);
    fireEvent.click(screen.getByRole('radio', { name: 'Active' }));
    expect(replace).toHaveBeenCalledWith(
      '/account/sonar/watchers?tab=runs',
      { scroll: false },
    );
  });

  it('clicking Active with no other params replaces with no trailing "?"', () => {
    currentSearch = 'runs=archived';
    render(<RunsFilterToggle value="archived" />);
    fireEvent.click(screen.getByRole('radio', { name: 'Active' }));
    expect(replace).toHaveBeenCalledWith('/account/sonar/watchers', { scroll: false });
  });
});

describe('parseRunsFilter', () => {
  it('returns "archived" only for the exact string "archived"', () => {
    expect(parseRunsFilter('archived')).toBe('archived');
  });

  it('returns "active" for anything else — absent, unknown, or an array', () => {
    expect(parseRunsFilter(undefined)).toBe('active');
    expect(parseRunsFilter('active')).toBe('active');
    expect(parseRunsFilter('bogus')).toBe('active');
    expect(parseRunsFilter(['archived', 'archived'])).toBe('active');
  });
});
