import '@testing-library/jest-dom/vitest';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ResolutionStatusBadge } from '../resolution-status-badge';

describe('ResolutionStatusBadge', () => {
  it.each([
    ['compliant', 'Compliant', 'text-teal'],
    ['partially_compliant', 'Partially compliant', 'text-orange'],
    ['non_compliant', 'Non-compliant', 'text-problem'],
  ] as const)('renders %s with label %s and class containing %s', (status, label, colorClass) => {
    render(<ResolutionStatusBadge resolution_status={status} />);
    const badge = screen.getByText(label);
    expect(badge).toBeInTheDocument();
    expect(badge.className).toContain(colorClass);
  });
});
