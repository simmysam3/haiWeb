import '@testing-library/jest-dom/vitest';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ThrottleBanner } from '../throttle-banner';

describe('ThrottleBanner', () => {
  it('renders the budget exhaustion message', () => {
    render(<ThrottleBanner />);
    expect(
      screen.getByText(/This run reached your hourly observation budget/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/It will continue automatically when budget refreshes/),
    ).toBeInTheDocument();
  });
});
