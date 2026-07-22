import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { WatcherScopePicker } from '../watcher-scope-picker';
import type { WatcherScope } from '@haiwave/protocol';

afterEach(() => {
  vi.unstubAllGlobals();
});

const empty: WatcherScope = {
  kind: 'watcher',
  authorization_basis: 'bilateral',
  counterparties: [],
  signal_types: ['lead_time_distribution'],
  skus: [],
  depth_limit: 1,
};

describe('<WatcherScopePicker>', () => {
  it('renders signal-type checkboxes with LT/CAP defaults', () => {
    const onChange = vi.fn();
    render(<WatcherScopePicker value={empty} onChange={onChange} />);
    expect(screen.getByLabelText(/LT/i)).toBeChecked();
  });

  it('toggling a signal-type checkbox calls onChange with the updated set', async () => {
    const onChange = vi.fn();
    render(<WatcherScopePicker value={empty} onChange={onChange} />);
    await userEvent.click(screen.getByLabelText(/CAP/i));
    expect(onChange).toHaveBeenCalled();
    const next = (onChange.mock.calls.at(-1)?.[0] as WatcherScope).signal_types;
    expect(next).toContain('capacity_utilization_band');
  });

  it('depth slider updates depth_limit in onChange', async () => {
    const onChange = vi.fn();
    render(<WatcherScopePicker value={empty} onChange={onChange} />);
    const slider = screen.getByLabelText(/^depth limit$/i) as HTMLInputElement;
    await userEvent.clear(slider);
    await userEvent.type(slider, '3');
    const next = (onChange.mock.calls.at(-1)?.[0] as WatcherScope).depth_limit;
    expect(next).toBe(3);
  });

  it('entering an ask quantity for a selected SKU emits sku_asks on the scope', async () => {
    const json = (body: unknown) => ({ ok: true, json: async () => body }) as Response;
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        if (url.includes('/audit/wizard-options')) {
          return Promise.resolve(
            json({
              counterparties: [
                {
                  counterparty_id: 'cccccccc-0000-0000-0000-000000000001',
                  counterparty_legal_name: 'Acme',
                  product_ids: ['PN-88A'],
                },
              ],
            }),
          );
        }
        if (url.includes('/catalog/classes')) return Promise.resolve(json({ classes: [] }));
        if (url.includes('/catalog/products')) {
          return Promise.resolve(
            json({
              products: [
                { external_product_id: 'PN-88A', product_name: 'Widget 88A', primary_class_slug: null },
              ],
              total: 1,
            }),
          );
        }
        return Promise.resolve(json({}));
      }),
    );

    const onChange = vi.fn();
    // Pre-select PN-88A so its leaf row (and the ask inputs) render once the
    // counterparty's catalog is expanded.
    const scope: WatcherScope = { ...empty, skus: ['PN-88A'] };
    render(<WatcherScopePicker value={scope} onChange={onChange} />);

    await userEvent.click(await screen.findByRole('button', { name: /expand acme/i }));
    await userEvent.click(await screen.findByRole('button', { name: /expand unclassified/i }));

    const qty = await screen.findByLabelText('Ask quantity for PN-88A');
    await userEvent.type(qty, '40');

    const last = onChange.mock.calls.at(-1)?.[0] as WatcherScope;
    expect(last.sku_asks).toEqual(
      expect.arrayContaining([expect.objectContaining({ sku: 'PN-88A', ask_quantity: 40 })]),
    );
  });
});
