import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { WatcherScopePicker } from '../watcher-scope-picker';
import type { WatcherScope } from '@haiwave/protocol';

afterEach(() => {
  vi.unstubAllGlobals();
});

// Stub the wizard-options + catalog endpoints so accepted SKUs (PN-88A, and
// optionally PN-99B) render under Acme's Unclassified class, exposing the
// inline ask inputs.
function stubCatalogFetch(skuIds: string[] = ['PN-88A']) {
  const json = (body: unknown) => ({ ok: true, json: async () => body }) as Response;
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string) => {
      // WatcherScopePicker mounts the shared picker with
      // universe="bilateral_connections" (v1.73 WP4 #22) — it draws its
      // counterparty universe from /api/account/partners, not the audit
      // wizard-options endpoint. Same counterparty_id as the wizard-options
      // stub below so the /catalog/* branches (matched by URL substring, not
      // by which universe produced the id) still resolve identically.
      if (url === '/api/account/partners') {
        return Promise.resolve(
          json([
            {
              id: 'cccccccc-0000-0000-0000-000000000001',
              company_name: 'Acme',
              status: 'trading_pair',
            },
          ]),
        );
      }
      if (url.includes('/audit/wizard-options')) {
        return Promise.resolve(
          json({
            counterparties: [
              {
                counterparty_id: 'cccccccc-0000-0000-0000-000000000001',
                counterparty_legal_name: 'Acme',
                product_ids: skuIds,
              },
            ],
          }),
        );
      }
      if (url.includes('/catalog/classes')) return Promise.resolve(json({ classes: [] }));
      if (url.includes('/catalog/products')) {
        return Promise.resolve(
          json({
            products: skuIds.map((id) => ({
              external_product_id: id,
              product_name: `Widget ${id}`,
              primary_class_slug: null,
            })),
            total: skuIds.length,
          }),
        );
      }
      return Promise.resolve(json({}));
    }),
  );
}

const empty: WatcherScope = {
  kind: 'watcher',
  authorization_basis: 'bilateral',
  counterparties: [],
  signal_types: ['published_lead_time'],
  skus: [],
  depth_limit: 1,
};

describe('<WatcherScopePicker>', () => {
  it('checks the signal-type checkboxes carried by the scope default', () => {
    const onChange = vi.fn();
    render(<WatcherScopePicker value={empty} onChange={onChange} />);
    expect(screen.getByLabelText('PLT')).toBeChecked();
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

  it('entering both an ask quantity and a target window (calendar days) for a selected SKU emits sku_asks on the scope', async () => {
    stubCatalogFetch();

    const onChange = vi.fn();
    // Pre-select PN-88A so its leaf row (and the ask inputs) render once the
    // counterparty's catalog is expanded.
    const scope: WatcherScope = { ...empty, skus: ['PN-88A'] };
    render(<WatcherScopePicker value={scope} onChange={onChange} />);

    await userEvent.click(await screen.findByRole('button', { name: /expand acme/i }));
    await userEvent.click(await screen.findByRole('button', { name: /expand unclassified/i }));

    const qty = await screen.findByLabelText('Ask quantity for PN-88A');
    await userEvent.type(qty, '40');
    const days = await screen.findByLabelText('Target window in calendar days for PN-88A');
    fireEvent.change(days, { target: { value: '30' } });

    const last = onChange.mock.calls.at(-1)?.[0] as WatcherScope;
    expect(last.sku_asks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ sku: 'PN-88A', ask_quantity: 40, target_days: 30 }),
      ]),
    );
  });

  // Edit-flow regression: a saved readiness watcher's asks must survive editing.
  // The ask drafts hydrate from scope.sku_asks, so the inputs show the saved
  // values and an unrelated selection change re-emits them rather than wiping
  // them (which would silently demote the watcher to a non-readiness one).
  it('hydrates saved sku_asks and preserves them across an unrelated selection change', async () => {
    stubCatalogFetch(['PN-88A', 'PN-99B']);

    const onChange = vi.fn();
    const scope: WatcherScope = {
      ...empty,
      skus: ['PN-88A', 'PN-99B'],
      sku_asks: [{ sku: 'PN-88A', ask_quantity: 40, target_days: 30 }],
    };
    render(<WatcherScopePicker value={scope} onChange={onChange} />);

    await userEvent.click(await screen.findByRole('button', { name: /expand acme/i }));
    await userEvent.click(await screen.findByRole('button', { name: /expand unclassified/i }));

    // The saved ask renders in the inline inputs (not blank).
    const qty = await screen.findByLabelText('Ask quantity for PN-88A');
    expect(qty).toHaveValue(40);
    expect(screen.getByLabelText('Target window in calendar days for PN-88A')).toHaveValue(30);

    // Deselect the OTHER SKU — a selection change that never touches PN-88A.
    // The leaf checkbox has no accessible label of its own; reach it through
    // its treeitem row.
    const otherRow = screen.getByText('Widget PN-99B').closest('[role="treeitem"]');
    expect(otherRow).not.toBeNull();
    await userEvent.click(within(otherRow as HTMLElement).getByRole('checkbox'));

    const last = onChange.mock.calls.at(-1)?.[0] as WatcherScope;
    expect(last.sku_asks).toEqual([{ sku: 'PN-88A', ask_quantity: 40, target_days: 30 }]);
  });

  // A blank target window makes an invalid ask that fails the run — so an ask must
  // be emitted only when BOTH a positive quantity and a positive window are present.
  it('does not emit a sku_ask when a quantity is entered but the target window is left blank', async () => {
    stubCatalogFetch();

    const onChange = vi.fn();
    const scope: WatcherScope = { ...empty, skus: ['PN-88A'] };
    render(<WatcherScopePicker value={scope} onChange={onChange} />);

    await userEvent.click(await screen.findByRole('button', { name: /expand acme/i }));
    await userEvent.click(await screen.findByRole('button', { name: /expand unclassified/i }));

    const qty = await screen.findByLabelText('Ask quantity for PN-88A');
    await userEvent.type(qty, '40');
    // Target date intentionally left untouched.

    const last = onChange.mock.calls.at(-1)?.[0] as WatcherScope;
    expect(last.sku_asks ?? []).toHaveLength(0);
  });

  // v1.60 layout: the ask cluster moved out of the row's right-aligned meta
  // slot onto its own detail line beneath the product, with visible labels —
  // the meta slot could not fit the boxes plus the predicted-date preview.
  it('renders ask inputs with visible labels on a detail line under the selected SKU', async () => {
    stubCatalogFetch();

    const scope: WatcherScope = {
      ...empty,
      skus: ['PN-88A'],
      sku_asks: [{ sku: 'PN-88A', ask_quantity: 40, target_days: 30 }],
    };
    render(<WatcherScopePicker value={scope} onChange={vi.fn()} />);

    await userEvent.click(await screen.findByRole('button', { name: /expand acme/i }));
    await userEvent.click(await screen.findByRole('button', { name: /expand unclassified/i }));

    // Visible labels (not just placeholders/aria-labels).
    const qtyLabel = await screen.findByText('Quantity');
    expect(screen.getByText('Target window')).toBeInTheDocument();
    // The predicted-date preview renders (target_days is set).
    expect(screen.getByText(/if run today/)).toBeInTheDocument();
    // The cluster lives on the detail line, outside the row's flex line.
    const row = screen.getByText('Widget PN-88A').closest('[role="treeitem"]');
    expect(row).not.toBeNull();
    expect(row).not.toContainElement(qtyLabel);
  });

  // A soft quote is synthesized against an ask quantity, so requesting the
  // signal with no per-SKU forward-demand ask yields baseline signals only. The
  // configuration is still valid, so the picker informs rather than blocks.
  it('warns when a soft quote is requested with no forward-demand ask', () => {
    const scope: WatcherScope = {
      ...empty,
      signal_types: ['soft_quoted_lead_time'],
      sku_asks: [],
    };
    render(<WatcherScopePicker value={scope} onChange={() => {}} />);

    expect(screen.getByText(/not a qualified ask/i)).toBeInTheDocument();
  });

  // The wizard seeds the soft-quote signal but never sets a sku_asks key at all,
  // so the state users actually land in is `undefined`, not `[]`. Covering only
  // `[]` leaves the nullish default untested: `[].length` is 0 either way, so
  // only an absent key makes `?? 0` load-bearing.
  it('warns when the soft-quote signal is selected and sku_asks is absent entirely', () => {
    const scope: WatcherScope = {
      ...empty,
      signal_types: ['soft_quoted_lead_time'],
    };
    render(<WatcherScopePicker value={scope} onChange={() => {}} />);

    expect(screen.getByText(/not a qualified ask/i)).toBeInTheDocument();
  });

  // Scoped to the qualified-ask warning's status region — the signal checkbox
  // labels also contain these names, and this scope (order state, no SKUs)
  // legitimately raises the per-SKU-scope warning alongside, so the query
  // targets the one status carrying the qualified-ask text.
  it('names only the baseline signals actually selected', () => {
    const scope: WatcherScope = {
      ...empty,
      signal_types: ['soft_quoted_lead_time', 'order_fulfillment_history'],
    };
    render(<WatcherScopePicker value={scope} onChange={() => {}} />);

    const warning = screen
      .getAllByRole('status')
      .find((el) => /not a qualified ask/i.test(el.textContent ?? ''));
    expect(warning).toBeDefined();
    expect(warning).toHaveTextContent(/order state/i);
    expect(warning).not.toHaveTextContent(/published lead time/i);
    expect(warning).not.toHaveTextContent(/capacity/i);
  });

  it('drops the warning once an ask is defined', () => {
    const scope: WatcherScope = {
      ...empty,
      signal_types: ['soft_quoted_lead_time'],
      sku_asks: [{ sku: 'SKU-1', ask_quantity: 25, target_days: 18 }],
    };
    render(<WatcherScopePicker value={scope} onChange={() => {}} />);

    expect(screen.queryByText(/not a qualified ask/i)).not.toBeInTheDocument();
  });

  it('does not warn when the soft-quote signal was never selected', () => {
    const scope: WatcherScope = {
      ...empty,
      signal_types: ['published_lead_time'],
      sku_asks: [],
    };
    render(<WatcherScopePicker value={scope} onChange={() => {}} />);

    expect(screen.queryByText(/not a qualified ask/i)).not.toBeInTheDocument();
  });

  // W2 (owner ruling 2026-08-10): order_fulfillment_history and
  // lead_time_distribution answer per SKU only — the agent gaps a SKU-less ask
  // as sku_scope_required. An unscoped template subscribing them goes dark for
  // those signals, so the picker says so. Informs, never blocks, same as the
  // qualified-ask warning above.
  it('warns when a per-SKU-only signal is selected with no SKU scope', () => {
    const scope: WatcherScope = {
      ...empty,
      signal_types: ['order_fulfillment_history'],
      skus: [],
    };
    render(<WatcherScopePicker value={scope} onChange={() => {}} />);

    expect(screen.getByText(/needs sku scope/i)).toBeInTheDocument();
  });

  it('drops the per-SKU warning once a SKU is scoped', () => {
    const scope: WatcherScope = {
      ...empty,
      signal_types: ['order_fulfillment_history'],
      skus: ['PN-88A'],
    };
    render(<WatcherScopePicker value={scope} onChange={() => {}} />);

    expect(screen.queryByText(/needs sku scope/i)).not.toBeInTheDocument();
  });

  it('does not raise the per-SKU warning for aggregate-capable signals alone', () => {
    const scope: WatcherScope = {
      ...empty,
      signal_types: ['published_lead_time', 'capacity_utilization_band'],
      skus: [],
    };
    render(<WatcherScopePicker value={scope} onChange={() => {}} />);

    expect(screen.queryByText(/needs sku scope/i)).not.toBeInTheDocument();
  });

  // lead_time_distribution is no longer offered by this picker, but templates
  // created over the API can still subscribe it and land here through the
  // editor — the warning keys off the scope, not the checkbox list.
  it('warns for an API-created template carrying lead_time_distribution with no SKUs', () => {
    const scope: WatcherScope = {
      ...empty,
      signal_types: ['lead_time_distribution'],
      skus: [],
    };
    render(<WatcherScopePicker value={scope} onChange={() => {}} />);

    expect(screen.getByText(/needs sku scope/i)).toBeInTheDocument();
  });

  // Fix round 2 (coordinator review): fix round 1's Critical fix (keeping an
  // un-expanded counterparty in the emitted scope) depends on WatcherScopePicker
  // actually forwarding `value.counterparties` down to the shared picker's
  // `counterparties` prop. Nothing else in this file asserts on emitted
  // `counterparties`, so deleting that one line of wiring would make the
  // Critical fix inert on the real edit route with every other test here
  // still green. This test pins the wiring itself, end to end through
  // WatcherScopePicker (not the shared component directly): a persisted
  // scope spanning two counterparties, only one of them expanded and edited,
  // must still emit both.
  it('forwards persisted value.counterparties so an un-expanded counterparty is not dropped when editing another (wiring pin)', async () => {
    const cpA = 'aaaaaaaa-1111-1111-1111-111111111111';
    const cpB = 'bbbbbbbb-2222-2222-2222-222222222222';
    const json = (body: unknown) => Promise.resolve({ ok: true, json: async () => body }) as Promise<Response>;
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        if (url === '/api/account/partners') {
          return json([
            { id: cpA, company_name: 'Northgate Fasteners', status: 'trading_pair' },
            { id: cpB, company_name: 'Southline Plastics', status: 'trading_pair' },
          ]);
        }
        if (url.includes(`/api/account/partners/${cpA}/catalog/classes`)) {
          return json({ classes: [] });
        }
        if (url.includes(`/api/account/partners/${cpA}/catalog/products`)) {
          return json({
            products: [
              { external_product_id: 'SKU-A1', product_name: 'Widget A1', primary_class_slug: null },
              { external_product_id: 'SKU-A2', product_name: 'Widget A2', primary_class_slug: null },
            ],
            total: 2,
          });
        }
        // cpB's catalog is deliberately never stubbed — it must stay
        // un-expanded, and a fetch to it here would itself be a bug (fan-out
        // on mount).
        throw new Error(`unexpected fetch: ${url}`);
      }),
    );

    const onChange = vi.fn();
    // The persisted scope: both counterparties already selected, one SKU
    // each. This mirrors watcher-definition-detail.tsx seeding
    // useState<WatcherScope>(template.scope) from a saved template.
    const scope: WatcherScope = {
      ...empty,
      counterparties: [cpA, cpB],
      skus: ['SKU-A1', 'SKU-B1'],
    };
    render(<WatcherScopePicker value={scope} onChange={onChange} />);

    // Expand and edit ONLY cpA — cpB stays collapsed throughout.
    await userEvent.click(
      await screen.findByRole('button', { name: /expand northgate fasteners/i }),
    );
    await userEvent.click(await screen.findByRole('button', { name: /expand unclassified/i }));

    const skuRow = (await screen.findByText('Widget A2')).closest('[role="treeitem"]');
    expect(skuRow).not.toBeNull();
    await userEvent.click(within(skuRow as HTMLElement).getByRole('checkbox'));

    const last = onChange.mock.calls.at(-1)?.[0] as WatcherScope;
    // cpB's SKU (SKU-B1) was never touched and stays selected — its
    // counterparty must not be silently dropped just because it was never
    // expanded.
    expect(last.counterparties).toEqual(expect.arrayContaining([cpA, cpB]));
    expect(last.skus).toEqual(expect.arrayContaining(['SKU-A1', 'SKU-A2', 'SKU-B1']));
  });
});
