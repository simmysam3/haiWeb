import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { GlobalSearch } from '../global-search';

const pushMock = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
}));

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    onClick,
    onMouseEnter,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
    onClick?: () => void;
    onMouseEnter?: () => void;
    [k: string]: unknown;
  }) => (
    <a href={href} onClick={onClick} onMouseEnter={onMouseEnter} {...props}>
      {children}
    </a>
  ),
}));

const fetchMock = vi.fn();

beforeEach(() => {
  pushMock.mockReset();
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function mockSearchResponse() {
  fetchMock.mockResolvedValue({
    ok: true,
    json: async () => ({
      counterparties: [
        {
          participant_id: '11111111-1111-1111-1111-111111111111',
          legal_name: 'Acme Widgets Inc',
          dba_name: null,
          status: 'active',
        },
      ],
      skus: [
        {
          product_id: 'PROD-A-001',
          sku_label: 'Stainless Bolt',
          responder_participant_id: '22222222-2222-2222-2222-222222222222',
          responder_legal_name: 'Vendor Co',
          status: 'outstanding',
          obligation_id: '33333333-3333-3333-3333-333333333333',
        },
      ],
      scopes: [
        {
          scope_id: '44444444-4444-4444-4444-444444444444',
          scope_type: 'product',
          subject: 'rubber-gasket',
          initiator_participant_id: '55555555-5555-5555-5555-555555555555',
          vendor_participant_id: '66666666-6666-6666-6666-666666666666',
          counterparty_legal_name: 'Vendor Co',
          acceptance_status: 'declined',
          created_at: new Date().toISOString(),
        },
      ],
    }),
  });
}

describe('GlobalSearch', () => {
  it('renders an accessible search input', () => {
    render(<GlobalSearch />);
    expect(screen.getByLabelText('Search')).toBeDefined();
  });

  it('does NOT fire the BFF call until query length >= 2 (min-length gate)', async () => {
    render(<GlobalSearch />);
    const input = screen.getByLabelText('Search');
    fireEvent.change(input, { target: { value: 'a' } });
    // Advance past the debounce window.
    vi.advanceTimersByTime(300);
    await waitFor(() => {
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  it('debounces input by ~250ms before firing the fetch', async () => {
    mockSearchResponse();
    render(<GlobalSearch />);
    const input = screen.getByLabelText('Search');
    fireEvent.change(input, { target: { value: 'acme' } });
    // Before the debounce expires, no fetch.
    vi.advanceTimersByTime(100);
    expect(fetchMock).not.toHaveBeenCalled();
    // After 250ms+ the debounce flushes.
    vi.advanceTimersByTime(200);
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
    });
    const calledUrl = fetchMock.mock.calls[0][0] as string;
    expect(calledUrl).toContain('/api/search?q=acme');
  });

  it('renders the three categorized sections from a happy response', async () => {
    mockSearchResponse();
    render(<GlobalSearch />);
    const input = screen.getByLabelText('Search');
    fireEvent.change(input, { target: { value: 'acme' } });
    vi.advanceTimersByTime(300);

    await waitFor(() => {
      expect(screen.getByText('Acme Widgets Inc')).toBeDefined();
    });
    expect(screen.getByText('Counterparties')).toBeDefined();
    expect(screen.getByText('SKUs')).toBeDefined();
    expect(screen.getByText('Scopes / Requests')).toBeDefined();
    expect(screen.getByText('Stainless Bolt')).toBeDefined();
    expect(screen.getByText('rubber-gasket')).toBeDefined();
  });

  it('shows a "See all results" CTA that routes to /account/search', async () => {
    mockSearchResponse();
    render(<GlobalSearch />);
    const input = screen.getByLabelText('Search');
    fireEvent.change(input, { target: { value: 'acme' } });
    vi.advanceTimersByTime(300);

    await waitFor(() => {
      expect(screen.getByText(/See all results/)).toBeDefined();
    });
    const btn = screen.getByText(/See all results/);
    fireEvent.click(btn);
    expect(pushMock).toHaveBeenCalledWith('/account/search?q=acme');
  });

  it('keyboard: ArrowDown opens the dropdown and highlights the first row', async () => {
    mockSearchResponse();
    render(<GlobalSearch />);
    const input = screen.getByLabelText('Search');
    fireEvent.change(input, { target: { value: 'acme' } });
    vi.advanceTimersByTime(300);
    await waitFor(() => {
      expect(screen.getByText('Acme Widgets Inc')).toBeDefined();
    });

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    // The first row (counterparty Acme) should now be aria-selected.
    const rows = screen.getAllByRole('option');
    expect(rows[0].getAttribute('aria-selected')).toBe('true');
  });

  it('keyboard: Enter on a highlighted row routes to its href', async () => {
    mockSearchResponse();
    render(<GlobalSearch />);
    const input = screen.getByLabelText('Search');
    fireEvent.change(input, { target: { value: 'acme' } });
    vi.advanceTimersByTime(300);
    await waitFor(() => {
      expect(screen.getByText('Acme Widgets Inc')).toBeDefined();
    });

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(pushMock).toHaveBeenCalledWith(
      '/account/partners/11111111-1111-1111-1111-111111111111',
    );
  });

  it('keyboard: Escape closes the dropdown', async () => {
    mockSearchResponse();
    render(<GlobalSearch />);
    const input = screen.getByLabelText('Search');
    fireEvent.change(input, { target: { value: 'acme' } });
    vi.advanceTimersByTime(300);
    await waitFor(() => {
      expect(screen.getByText('Acme Widgets Inc')).toBeDefined();
    });

    fireEvent.keyDown(input, { key: 'Escape' });
    expect(screen.queryByText('Acme Widgets Inc')).toBeNull();
  });
});
