import '@testing-library/jest-dom/vitest';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ComplianceReservedFooter } from '../compliance-reserved-footer';

describe('ComplianceReservedFooter', () => {
  it('renders the reserved-fields disclosure copy', () => {
    render(<ComplianceReservedFooter />);
    expect(
      screen.getByText(/Compliance reporting fields .* are reserved for a future release/i),
    ).toBeInTheDocument();
  });
});
