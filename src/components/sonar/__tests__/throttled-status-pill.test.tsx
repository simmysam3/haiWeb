import '@testing-library/jest-dom/vitest';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ThrottledStatusPill } from '../throttled-status-pill';

describe('ThrottledStatusPill', () => {
  it('shows a countdown label and a definition tooltip', () => {
    const future = new Date(Date.now() + 10 * 60_000).toISOString();
    render(<ThrottledStatusPill nextResumeAt={future} />);
    expect(screen.getByText(/Throttled · Resumes in/)).toBeInTheDocument();
    const tip = document.getElementById(
      screen.getByTestId('pill').getAttribute('aria-describedby') as string,
    );
    expect(tip).toHaveTextContent(/hop budget was exhausted/i);
  });
});
