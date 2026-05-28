import '@testing-library/jest-dom/vitest';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { NavBadge } from '../nav-badge';

describe('NavBadge', () => {
  it('renders the count', () => {
    render(<NavBadge count={5} oldestAgeDays={1} />);
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('renders nothing when count is 0', () => {
    const { container } = render(<NavBadge count={0} oldestAgeDays={null} />);
    expect(container.firstChild).toBeNull();
  });

  it('always uses the brand orange tone regardless of age', () => {
    for (const age of [1, 5, 11, null]) {
      const { container } = render(<NavBadge count={3} oldestAgeDays={age} />);
      expect(container.firstChild).toHaveClass('bg-orange');
      expect(container.firstChild).not.toHaveClass('bg-slate-500');
      expect(container.firstChild).not.toHaveClass('bg-amber-500');
      expect(container.firstChild).not.toHaveClass('bg-red-500');
    }
  });

  it('renders without the optional oldestAgeDays prop', () => {
    render(<NavBadge count={4} />);
    expect(screen.getByText('4')).toBeInTheDocument();
  });
});
