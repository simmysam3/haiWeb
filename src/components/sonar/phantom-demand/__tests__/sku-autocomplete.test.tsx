import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { SkuAutocomplete } from '../sku-autocomplete';

describe('SkuAutocomplete', () => {
  const fetcher = vi.fn().mockResolvedValue([
    { sku: 'HC-9000', label: 'Hydraulic Controller 9000' },
    { sku: 'HC-9000-LITE', label: 'Hydraulic Controller 9000 Lite' },
  ]);

  it('shows suggestions after typing', async () => {
    render(<SkuAutocomplete value="" onChange={vi.fn()} fetcher={fetcher} />);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'HC' } });
    await waitFor(() => expect(fetcher).toHaveBeenCalledWith('HC'));
    expect(await screen.findByText('Hydraulic Controller 9000')).toBeInTheDocument();
  });

  it('calls onChange when a suggestion is clicked', async () => {
    const onChange = vi.fn();
    render(<SkuAutocomplete value="" onChange={onChange} fetcher={fetcher} />);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'HC' } });
    fireEvent.click(await screen.findByText('Hydraulic Controller 9000'));
    expect(onChange).toHaveBeenCalledWith('HC-9000');
  });
});
