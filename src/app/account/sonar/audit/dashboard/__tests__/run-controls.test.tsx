import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

import { RunControls } from '../run-controls';

describe('RunControls', () => {
  it('renders Run-audit-now and Save-as-template buttons', () => {
    render(<RunControls />);
    expect(screen.getByRole('button', { name: /run audit now/i })).toBeInTheDocument();
    const link = screen.getByRole('link', { name: /save as template/i });
    expect(link).toHaveAttribute(
      'href',
      '/account/sonar/templates/new?observation_class=audit',
    );
  });
});
