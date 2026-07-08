import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ComingSoon } from '../coming-soon';

describe('ComingSoon', () => {
  it('renders a "Coming soon" message', () => {
    render(<ComingSoon />);
    expect(screen.getByText(/coming soon/i)).toBeTruthy();
  });

  it('renders an optional note when provided', () => {
    render(<ComingSoon note="Billing ships with the Stripe integration." />);
    expect(screen.getByText('Billing ships with the Stripe integration.')).toBeTruthy();
  });
});
