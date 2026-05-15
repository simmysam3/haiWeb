import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PartnerSkuPicker } from '../partner-sku-picker';

const fetchMock = vi.fn();
beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

function resolveProducts() {
  fetchMock.mockResolvedValueOnce(
    new Response(
      JSON.stringify({
        products: [
          { external_product_id: 'AC-LENS-2200', product_name: null, primary_class_slug: null },
          { external_product_id: 'FAST-HEX-M8', product_name: null, primary_class_slug: null },
        ],
        total: 2,
      }),
      { status: 200 },
    ),
  );
}

describe('PartnerSkuPicker', () => {
  it('is disabled with a hint when no counterparty is selected', () => {
    render(<PartnerSkuPicker counterpartyId="" value={[]} onChange={vi.fn()} />);
    expect(screen.getByText(/select a counterparty first/i)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('loads the partner product list flat (no class_id) and toggles selection', async () => {
    resolveProducts();
    const onChange = vi.fn();
    render(<PartnerSkuPicker counterpartyId="p1" value={[]} onChange={onChange} />);
    await userEvent.click(await screen.findByText('AC-LENS-2200'));
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/account/partners/p1/catalog/products?page=1&size=500',
    );
    expect(onChange).toHaveBeenCalledWith(['AC-LENS-2200']);
  });

  it('adds a free-text SKU, trimming and de-duping', async () => {
    resolveProducts();
    const onChange = vi.fn();
    render(<PartnerSkuPicker counterpartyId="p1" value={['AC-LENS-2200']} onChange={onChange} />);
    await screen.findByText('FAST-HEX-M8');
    await userEvent.type(screen.getByPlaceholderText(/sku i have in mind/i), '  MY-CUSTOM-1  ');
    await userEvent.click(screen.getByRole('button', { name: /add/i }));
    expect(onChange).toHaveBeenCalledWith(['AC-LENS-2200', 'MY-CUSTOM-1']);
  });

  it('does not add a duplicate free-text SKU', async () => {
    resolveProducts();
    const onChange = vi.fn();
    render(<PartnerSkuPicker counterpartyId="p1" value={['DUP-1']} onChange={onChange} />);
    await screen.findByText('FAST-HEX-M8');
    await userEvent.type(screen.getByPlaceholderText(/sku i have in mind/i), 'DUP-1');
    await userEvent.click(screen.getByRole('button', { name: /add/i }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('removes a selected SKU via its chip', async () => {
    resolveProducts();
    const onChange = vi.fn();
    render(<PartnerSkuPicker counterpartyId="p1" value={['AC-LENS-2200', 'X-1']} onChange={onChange} />);
    await screen.findByText('FAST-HEX-M8');
    await userEvent.click(screen.getByRole('button', { name: /remove X-1/i }));
    expect(onChange).toHaveBeenCalledWith(['AC-LENS-2200']);
  });
});
