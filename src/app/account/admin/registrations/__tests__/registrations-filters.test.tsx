import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const mockPush = vi.fn();
let currentSearch = '';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => '/account/admin/registrations',
  useSearchParams: () => new URLSearchParams(currentSearch),
}));

import { RegistrationsFilters } from '../registrations-filters';

beforeEach(() => {
  mockPush.mockReset();
  currentSearch = '';
});

describe('RegistrationsFilters — BUG-3 gatekeeper queue filters', () => {
  it('renders the four status tabs and the risk-tier options', () => {
    render(<RegistrationsFilters />);

    // Status tab strip
    expect(screen.getByRole('button', { name: /^Pending/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Approved/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Rejected/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^All/ })).toBeInTheDocument();

    // Risk-tier dropdown options (display labels)
    const select = screen.getByRole('combobox', { name: /risk tier/i });
    const optionLabels = Array.from(select.querySelectorAll('option')).map(
      (o) => o.textContent,
    );
    expect(optionLabels).toEqual(['All', 'Standard', 'Foreign', 'Sanctioned']);
  });

  it('defaults to the Pending status when no status param is set', () => {
    currentSearch = '';
    render(<RegistrationsFilters />);
    // Clicking Pending (the implicit default) clears the status param.
    fireEvent.click(screen.getByRole('button', { name: /^Pending/ }));
    expect(mockPush).toHaveBeenCalledWith('/account/admin/registrations');
  });

  it('clicking Approved pushes ?status=approved', () => {
    render(<RegistrationsFilters />);
    fireEvent.click(screen.getByRole('button', { name: /^Approved/ }));
    expect(mockPush).toHaveBeenCalledWith(
      '/account/admin/registrations?status=approved',
    );
  });

  it('clicking Rejected pushes ?status=rejected', () => {
    render(<RegistrationsFilters />);
    fireEvent.click(screen.getByRole('button', { name: /^Rejected/ }));
    expect(mockPush).toHaveBeenCalledWith(
      '/account/admin/registrations?status=rejected',
    );
  });

  it('clicking All sets the explicit status=all sentinel (distinct from the pending default)', () => {
    currentSearch = 'status=approved';
    render(<RegistrationsFilters />);
    fireEvent.click(screen.getByRole('button', { name: /^All/ }));
    expect(mockPush).toHaveBeenCalledWith(
      '/account/admin/registrations?status=all',
    );
  });

  it('reflects the active status from the URL (approved → Approved tab active)', () => {
    currentSearch = 'status=approved';
    render(<RegistrationsFilters />);
    // Clicking the already-active tab re-pushes the same canonical URL.
    fireEvent.click(screen.getByRole('button', { name: /^Approved/ }));
    expect(mockPush).toHaveBeenCalledWith(
      '/account/admin/registrations?status=approved',
    );
  });

  // BUG-4: the URL now carries the *display token* (standard|foreign|sanctioned),
  // not the underlying risk_tier enum, because the filter is non-exclusive and
  // mirrors the pill display (a blocked row shows both Foreign and Sanctioned).
  it('selecting risk tier "Sanctioned" pushes risk_tier=sanctioned (display token)', () => {
    render(<RegistrationsFilters />);
    const select = screen.getByRole('combobox', { name: /risk tier/i });
    fireEvent.change(select, { target: { value: 'sanctioned' } });
    expect(mockPush).toHaveBeenCalledWith(
      '/account/admin/registrations?risk_tier=sanctioned',
    );
  });

  it('selecting risk tier "Foreign" pushes risk_tier=foreign (display token)', () => {
    render(<RegistrationsFilters />);
    const select = screen.getByRole('combobox', { name: /risk tier/i });
    fireEvent.change(select, { target: { value: 'foreign' } });
    expect(mockPush).toHaveBeenCalledWith(
      '/account/admin/registrations?risk_tier=foreign',
    );
  });

  it('selecting risk tier "All" omits the risk_tier param', () => {
    currentSearch = 'risk_tier=sanctioned';
    render(<RegistrationsFilters />);
    const select = screen.getByRole('combobox', { name: /risk tier/i });
    fireEvent.change(select, { target: { value: '' } });
    expect(mockPush).toHaveBeenCalledWith('/account/admin/registrations');
  });

  it('reflects the active risk tier from the URL (sanctioned token → Sanctioned selected)', () => {
    currentSearch = 'risk_tier=sanctioned';
    render(<RegistrationsFilters />);
    const select = screen.getByRole('combobox', {
      name: /risk tier/i,
    }) as HTMLSelectElement;
    expect(select.value).toBe('sanctioned');
  });

  it('preserves the other filter when changing status', () => {
    currentSearch = 'risk_tier=foreign';
    render(<RegistrationsFilters />);
    fireEvent.click(screen.getByRole('button', { name: /^Approved/ }));
    expect(mockPush).toHaveBeenCalledWith(
      '/account/admin/registrations?risk_tier=foreign&status=approved',
    );
  });

  it('preserves the other filter when changing risk tier', () => {
    currentSearch = 'status=rejected';
    render(<RegistrationsFilters />);
    const select = screen.getByRole('combobox', { name: /risk tier/i });
    fireEvent.change(select, { target: { value: 'standard' } });
    expect(mockPush).toHaveBeenCalledWith(
      '/account/admin/registrations?status=rejected&risk_tier=standard',
    );
  });
});
