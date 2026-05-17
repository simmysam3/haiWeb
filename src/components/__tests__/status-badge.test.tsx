import '@testing-library/jest-dom/vitest';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatusBadge } from '../status-badge';

describe('StatusBadge', () => {
  it('keeps its label behaviour (humanised status)', () => {
    render(<StatusBadge status="past_due" />);
    expect(screen.getByText('Past Due')).toBeInTheDocument();
  });

  it('exposes a definition tooltip via the Pill primitive', () => {
    render(<StatusBadge status="banned" />);
    const pill = screen.getByTestId('pill');
    const tip = document.getElementById(
      pill.getAttribute('aria-describedby') as string,
    );
    expect(tip).toHaveTextContent(/permanently blocked/i);
  });
});
