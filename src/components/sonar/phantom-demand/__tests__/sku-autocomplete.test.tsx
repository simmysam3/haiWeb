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

  // QUA-web-sonar-4-19 (owner ruling R-5a, 2026-09-05): only a suggestion click
  // propagated a value, so a SKU typed exactly — one the fetcher does not know,
  // e.g. past the first 500 of a large catalog — was thrown away on save.
  it('propagates a typed SKU that has no suggestion', async () => {
    const onChange = vi.fn();
    const noHits = vi.fn().mockResolvedValue([]);
    render(<SkuAutocomplete value="" onChange={onChange} fetcher={noHits} />);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'ZZ-77' } });
    await waitFor(() => expect(noHits).toHaveBeenCalledWith('ZZ-77'));
    expect(onChange).toHaveBeenCalledWith('ZZ-77');
  });

  it('selects a suggestion from the keyboard: ArrowDown to the second hit, Enter picks it', async () => {
    const onChange = vi.fn();
    render(<SkuAutocomplete value="" onChange={onChange} fetcher={fetcher} />);
    const box = screen.getByRole('combobox');
    fireEvent.change(box, { target: { value: 'HC' } });
    await screen.findByText('Hydraulic Controller 9000 Lite');
    fireEvent.keyDown(box, { key: 'ArrowDown' });
    fireEvent.keyDown(box, { key: 'ArrowDown' });
    fireEvent.keyDown(box, { key: 'Enter' });
    expect(onChange).toHaveBeenLastCalledWith('HC-9000-LITE');
    expect(screen.queryByText('Hydraulic Controller 9000 Lite')).not.toBeInTheDocument();
  });

  it('is a combobox over a listbox of options, and names the active option', async () => {
    render(<SkuAutocomplete value="" onChange={vi.fn()} fetcher={fetcher} />);
    const box = screen.getByRole('combobox');
    fireEvent.change(box, { target: { value: 'HC' } });
    const list = await screen.findByRole('listbox');
    expect(box).toHaveAttribute('aria-controls', list.id);
    expect(box).toHaveAttribute('aria-autocomplete', 'list');
    const options = screen.getAllByRole('option');
    expect(options).toHaveLength(2);
    fireEvent.keyDown(box, { key: 'ArrowDown' });
    expect(options[0]).toHaveAttribute('aria-selected', 'true');
    expect(box).toHaveAttribute('aria-activedescendant', options[0].id);
  });
});
