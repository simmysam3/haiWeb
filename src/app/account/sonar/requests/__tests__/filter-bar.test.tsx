import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const mockPush = vi.fn();
let currentPathname = '/account/sonar/requests';
let currentSearch = '';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => currentPathname,
  useSearchParams: () => new URLSearchParams(currentSearch),
}));

import { FilterBar } from '../_components/filter-bar';

const options = [
  { id: '11111111-1111-1111-1111-111111111111', label: 'Acme Co' },
  { id: '22222222-2222-2222-2222-222222222222', label: 'Beta Inc' },
];

beforeEach(() => {
  mockPush.mockReset();
  currentPathname = '/account/sonar/requests';
  currentSearch = '';
});

describe('FilterBar — v.1.37 IA', () => {
  it('renders all 4 filter dropdowns', () => {
    render(<FilterBar counterpartyOptions={options} />);
    expect(screen.getByText(/Item type:/i)).toBeInTheDocument();
    expect(screen.getByText(/^State:/i)).toBeInTheDocument();
    expect(screen.getByText(/Counterparty:/i)).toBeInTheDocument();
    expect(screen.getByText(/^Age:/i)).toBeInTheDocument();
    // 4 <select> elements wired to the dropdowns.
    expect(screen.getAllByRole('combobox')).toHaveLength(4);
  });

  it('setting Item type pushes ?item_type=nomination', () => {
    render(<FilterBar counterpartyOptions={options} />);
    const [itemTypeSelect] = screen.getAllByRole('combobox');
    fireEvent.change(itemTypeSelect, { target: { value: 'nomination' } });
    expect(mockPush).toHaveBeenCalledWith('/account/sonar/requests?item_type=nomination');
  });

  it('setting Age pushes ?age_bucket=today', () => {
    render(<FilterBar counterpartyOptions={options} />);
    const selects = screen.getAllByRole('combobox');
    const ageSelect = selects[3];
    fireEvent.change(ageSelect, { target: { value: 'today' } });
    expect(mockPush).toHaveBeenCalledWith('/account/sonar/requests?age_bucket=today');
  });

  it('setting State to a bucket pushes ?state=…', () => {
    render(<FilterBar counterpartyOptions={options} />);
    const selects = screen.getAllByRole('combobox');
    const stateSelect = selects[1];
    fireEvent.change(stateSelect, { target: { value: 'pending' } });
    expect(mockPush).toHaveBeenCalledWith('/account/sonar/requests?state=pending');
  });

  it('omits Declined from the State dropdown (v.1.41: now its own direction tab)', () => {
    render(<FilterBar counterpartyOptions={options} />);
    const stateSelect = screen.getAllByRole('combobox')[1];
    const declinedOption = Array.from(stateSelect.querySelectorAll('option')).find(
      (o) => o.value === 'declined',
    );
    expect(declinedOption).toBeUndefined();
  });

  it('still renders a chip for legacy `?state=declined` URL parameter', () => {
    currentSearch = 'state=declined';
    render(<FilterBar counterpartyOptions={options} />);
    expect(screen.getByText(/State: Declined/)).toBeInTheDocument();
  });

  it('surfaces the blocked (non-participant) state option', () => {
    render(<FilterBar counterpartyOptions={options} />);
    expect(
      screen.getByRole('option', { name: /Blocked \(non-participant\)/i }),
    ).toBeInTheDocument();
  });

  it('setting State=blocked pushes ?state=blocked (no /declined redirect)', () => {
    render(<FilterBar counterpartyOptions={options} />);
    const stateSelect = screen.getAllByRole('combobox')[1];
    fireEvent.change(stateSelect, { target: { value: 'blocked' } });
    expect(mockPush).toHaveBeenCalledWith('/account/sonar/requests?state=blocked');
  });

  it('renders a chip with the Blocked label when state=blocked is active', () => {
    currentSearch = 'state=blocked';
    render(<FilterBar counterpartyOptions={options} />);
    expect(screen.getByText(/State: Blocked \(non-participant\)/)).toBeInTheDocument();
  });

  it('renders chips for active filters with item type label', () => {
    currentSearch = 'item_type=nomination&counterparty=11111111-1111-1111-1111-111111111111';
    render(<FilterBar counterpartyOptions={options} />);
    expect(screen.getByText(/Item type: Nomination/)).toBeInTheDocument();
    expect(screen.getByText(/Counterparty: Acme Co/)).toBeInTheDocument();
  });

  it('clicking a chip clears that filter', () => {
    currentSearch = 'item_type=nomination';
    render(<FilterBar counterpartyOptions={options} />);
    const chip = screen.getByRole('button', { name: /Item type: Nomination/ });
    fireEvent.click(chip);
    // Empty params → no '?' suffix.
    expect(mockPush).toHaveBeenCalledWith('/account/sonar/requests');
  });

  it('shows Clear all filters link when 2+ chips active', () => {
    currentSearch = 'item_type=nomination&age_bucket=today';
    render(<FilterBar counterpartyOptions={options} />);
    expect(screen.getByText(/Clear all filters/)).toBeInTheDocument();
  });

  it('Clear all filters resets the URL to pathname', () => {
    currentSearch = 'item_type=nomination&age_bucket=today';
    render(<FilterBar counterpartyOptions={options} />);
    fireEvent.click(screen.getByText(/Clear all filters/));
    expect(mockPush).toHaveBeenCalledWith('/account/sonar/requests');
  });

  it('does NOT show Clear all when only 1 chip is active', () => {
    currentSearch = 'item_type=nomination';
    render(<FilterBar counterpartyOptions={options} />);
    expect(screen.queryByText(/Clear all filters/)).not.toBeInTheDocument();
  });

  it('reflects legacy `type` alias from v1.35 301 redirects in the dropdown', () => {
    currentSearch = 'type=nomination';
    render(<FilterBar counterpartyOptions={options} />);
    const itemTypeSelect = screen.getAllByRole('combobox')[0] as HTMLSelectElement;
    expect(itemTypeSelect.value).toBe('nomination');
  });
});
