import '@testing-library/jest-dom/vitest';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LeastCompliantPanel } from '../least-compliant-panel';

describe('LeastCompliantPanel', () => {
  it('renders empty-state copy under D8 graceful degrade', () => {
    render(<LeastCompliantPanel />);
    expect(screen.getByText(/Least Compliant Vendors/i)).toBeInTheDocument();
    expect(screen.getByText(/future release/i)).toBeInTheDocument();
  });
});
