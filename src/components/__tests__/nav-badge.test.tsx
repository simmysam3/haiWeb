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

  it('uses grey tone when oldestAgeDays < 3', () => {
    const { container } = render(<NavBadge count={2} oldestAgeDays={2} />);
    expect(container.firstChild).toHaveClass('bg-slate-500');
  });

  it('uses amber tone when oldestAgeDays in [3,10]', () => {
    const { container } = render(<NavBadge count={3} oldestAgeDays={5} />);
    expect(container.firstChild).toHaveClass('bg-amber-500');
  });

  it('uses red tone when oldestAgeDays > 10', () => {
    const { container } = render(<NavBadge count={3} oldestAgeDays={11} />);
    expect(container.firstChild).toHaveClass('bg-red-500');
  });
});
