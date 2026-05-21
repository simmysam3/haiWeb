import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { VendorPickerStep } from '../vendor-picker-step';

const PARTNERS = [
  { id: 'v1', company_name: 'Apex Manufacturing', status: 'trading_pair' },
  { id: 'v2', company_name: 'Great Lakes Components', status: 'approved' },
  { id: 'v3', company_name: 'Precision Bearings Co', status: 'trading_pair' },
];

beforeEach(() => {
  globalThis.fetch = vi.fn().mockResolvedValue(
    new Response(JSON.stringify(PARTNERS), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }),
  ) as unknown as typeof fetch;
});

describe('VendorPickerStep', () => {
  it('lists active partners after fetch', async () => {
    render(<VendorPickerStep onAdvance={() => {}} />);
    await waitFor(() => {
      expect(screen.getByText('Apex Manufacturing')).toBeInTheDocument();
    });
    expect(screen.getByText('Great Lakes Components')).toBeInTheDocument();
    expect(screen.getByText('Precision Bearings Co')).toBeInTheDocument();
  });

  it('filters list by case-insensitive substring match on legal_name', async () => {
    render(<VendorPickerStep onAdvance={() => {}} />);
    await waitFor(() => screen.getByText('Apex Manufacturing'));
    await userEvent.type(screen.getByPlaceholderText(/search vendors/i), 'great');
    expect(screen.queryByText('Apex Manufacturing')).not.toBeInTheDocument();
    expect(screen.getByText('Great Lakes Components')).toBeInTheDocument();
    expect(screen.queryByText('Precision Bearings Co')).not.toBeInTheDocument();
  });

  it('calls onAdvance with vendor id and name when a row is clicked', async () => {
    const onAdvance = vi.fn();
    render(<VendorPickerStep onAdvance={onAdvance} />);
    await waitFor(() => screen.getByText('Apex Manufacturing'));
    await userEvent.click(screen.getByText('Apex Manufacturing'));
    expect(onAdvance).toHaveBeenCalledWith({ id: 'v1', legal_name: 'Apex Manufacturing' });
  });

  it('renders an error message and no list on fetch failure', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response('boom', { status: 500 }),
    ) as unknown as typeof fetch;
    render(<VendorPickerStep onAdvance={() => {}} />);
    await waitFor(() => {
      expect(screen.getByText(/couldn.t load trading partners/i)).toBeInTheDocument();
    });
  });
});
