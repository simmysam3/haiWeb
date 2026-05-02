import '@testing-library/jest-dom/vitest';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ThrottledRunsPanel } from '../throttled-runs-panel';

describe('ThrottledRunsPanel', () => {
  it('returns null (renders nothing) when total === 0', () => {
    const { container } = render(
      <ThrottledRunsPanel counts={{ audit: 0, type2: 0, total: 0 }} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders the panel when total > 0', () => {
    render(<ThrottledRunsPanel counts={{ audit: 2, type2: 1, total: 3 }} />);
    expect(screen.getByText('Throttled runs')).toBeInTheDocument();
    expect(screen.getByText(/3 runs currently waiting for budget refresh/)).toBeInTheDocument();
  });

  it('shows audit count detail when audit > 0', () => {
    render(<ThrottledRunsPanel counts={{ audit: 2, type2: 0, total: 2 }} />);
    expect(screen.getByText(/· 2 audit/)).toBeInTheDocument();
  });

  it('shows type2 count detail when type2 > 0', () => {
    render(<ThrottledRunsPanel counts={{ audit: 0, type2: 1, total: 1 }} />);
    expect(screen.getByText(/· 1 Type 2/)).toBeInTheDocument();
  });

  it('uses singular "run" when total === 1', () => {
    render(<ThrottledRunsPanel counts={{ audit: 1, type2: 0, total: 1 }} />);
    expect(screen.getByText(/1 run currently waiting/)).toBeInTheDocument();
    // Should NOT contain "runs" (plural)
    expect(screen.queryByText(/1 runs/)).not.toBeInTheDocument();
  });
});
