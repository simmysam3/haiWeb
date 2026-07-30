import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { VerifiedUndisclosedChip } from '../verified-undisclosed-chip';

afterEach(() => vi.restoreAllMocks());

describe('VerifiedUndisclosedChip', () => {
  it('renders the alias form', () => {
    render(<VerifiedUndisclosedChip alias="A" />);
    expect(screen.getByText('Supplier A')).toBeInTheDocument();
  });

  it('renders the generic form without an alias', () => {
    render(<VerifiedUndisclosedChip />);
    expect(screen.getByText('Identity withheld')).toBeInTheDocument();
  });

  it('carries the disclosure tooltip definition (no dev console.warn)', () => {
    const warn = vi.spyOn(console, 'warn');
    render(<VerifiedUndisclosedChip alias="B" />);
    expect(warn).not.toHaveBeenCalled();
  });
});
