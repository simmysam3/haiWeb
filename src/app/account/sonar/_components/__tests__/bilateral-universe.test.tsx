import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BilateralCounterpartiesSkusFields } from '../bilateral-counterparties-skus-fields';

const PARTNERS = [
  { id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', company_name: 'MidWest Fastener Corp', status: 'trading_pair' },
  { id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', company_name: 'Precision Plastics Inc', status: 'approved' },
];

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('BilateralCounterpartiesSkusFields — universe prop', () => {
  it('bilateral_connections lists trading pairs (never approved-only partners) and never calls wizard-options', async () => {
    const fetchMock = vi.spyOn(global, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url === '/api/account/partners') {
        return new Response(JSON.stringify(PARTNERS), { status: 200 });
      }
      throw new Error(`unexpected fetch: ${url}`);
    });
    render(
      <BilateralCounterpartiesSkusFields
        skus={[]}
        onChange={() => {}}
        universe="bilateral_connections"
      />,
    );
    expect(await screen.findByText('MidWest Fastener Corp')).toBeInTheDocument();
    expect(screen.queryByText('Precision Plastics Inc')).toBeNull();
    expect(fetchMock.mock.calls.map((c) => String(c[0]))).not.toContain(
      '/api/account/sonar/audit/wizard-options',
    );
  });

  it('bilateral empty state names Partners, not audit nomination ceremony', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify([]), { status: 200 }),
    );
    render(
      <BilateralCounterpartiesSkusFields skus={[]} onChange={() => {}} universe="bilateral_connections" />,
    );
    expect(await screen.findByText(/no active trading pairs/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /partners/i })).toHaveAttribute('href', '/account/partners');
    expect(screen.queryByText(/nomination/i)).toBeNull();
  });

  it('default universe still fetches wizard-options (audit wizard unchanged)', async () => {
    const fetchMock = vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ counterparties: [] }), { status: 200 }),
    );
    render(<BilateralCounterpartiesSkusFields skus={[]} onChange={() => {}} />);
    await waitFor(() =>
      expect(fetchMock.mock.calls.map((c) => String(c[0]))).toContain(
        '/api/account/sonar/audit/wizard-options',
      ),
    );
  });

  // Required addition (not in the brief's three): the brief's mechanism relies
  // on loadCatalog folding each lazily-loaded catalog's product ids back into
  // `options` under the bilateral universe, because emitWith derives the
  // emitted counterparty set from `cp.product_ids` membership — and the mount
  // fetch seeds `product_ids: []` for every trading pair. If the fold-back is
  // wrong, missing, or races a selection, a selected SKU's counterparty is
  // silently dropped from the emitted scope: a watcher scoped to nothing, with
  // every other test in this file still green. This test exercises that path
  // end to end: load the trading-pair universe, expand a counterparty so its
  // catalog loads, select a SKU from that catalog, and assert the emitted
  // scope includes both the SKU and its counterparty.
  it('selecting a SKU from a lazily-loaded catalog emits its counterparty (fold-back path)', async () => {
    const counterpartyId = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
    vi.spyOn(global, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url === '/api/account/partners') {
        return new Response(
          JSON.stringify([
            { id: counterpartyId, company_name: 'Acme Bearings', status: 'trading_pair' },
          ]),
          { status: 200 },
        );
      }
      if (url.includes(`/api/account/partners/${counterpartyId}/catalog/classes`)) {
        return new Response(JSON.stringify({ classes: [] }), { status: 200 });
      }
      if (url.includes(`/api/account/partners/${counterpartyId}/catalog/products`)) {
        return new Response(
          JSON.stringify({
            products: [
              { external_product_id: 'PN-1', product_name: 'Widget PN-1', primary_class_slug: null },
            ],
            total: 1,
          }),
          { status: 200 },
        );
      }
      throw new Error(`unexpected fetch: ${url}`);
    });

    const onChange = vi.fn();
    render(
      <BilateralCounterpartiesSkusFields
        skus={[]}
        onChange={onChange}
        universe="bilateral_connections"
      />,
    );

    // Expand the counterparty — triggers the lazy catalog load.
    await userEvent.click(await screen.findByRole('button', { name: /expand acme bearings/i }));
    // Expand the (unclassified) class group to reach the leaf checkbox.
    await userEvent.click(await screen.findByRole('button', { name: /expand unclassified/i }));

    const skuRow = (await screen.findByText('Widget PN-1')).closest('[role="treeitem"]');
    expect(skuRow).not.toBeNull();
    const checkbox = skuRow!.querySelector('input[type="checkbox"]');
    expect(checkbox).not.toBeNull();
    await userEvent.click(checkbox as HTMLInputElement);

    await waitFor(() => {
      const last = onChange.mock.calls.at(-1)?.[0] as {
        counterparties: string[];
        skus: string[];
      };
      expect(last.skus).toContain('PN-1');
      expect(last.counterparties).toContain(counterpartyId);
    });
  });

  // Fix round 1 (coordinator review, Critical): the watcher EDIT route
  // (watcher-definition-detail.tsx → WatcherScopePicker) seeds the picker
  // from a PERSISTED scope whose counterparties are already selected but not
  // yet expanded in the UI. Under bilateral_connections a counterparty's
  // product_ids stays [] until THAT counterparty is individually expanded
  // (loadCatalog's fold-back) — audit doesn't have this problem because
  // wizard-options populates every counterparty's product_ids at mount.
  // Editing one counterparty's selection therefore must not silently drop a
  // DIFFERENT, un-expanded counterparty whose SKUs are still selected — that
  // narrows the saved watcher's scope without the user touching it.
  it('keeps an un-expanded counterparty in the emitted scope when a different counterparty is edited (bilateral edit-route asymmetry)', async () => {
    const cpA = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
    const cpB = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';
    vi.spyOn(global, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url === '/api/account/partners') {
        return new Response(
          JSON.stringify([
            { id: cpA, company_name: 'Northgate Fasteners', status: 'trading_pair' },
            { id: cpB, company_name: 'Southline Plastics', status: 'trading_pair' },
          ]),
          { status: 200 },
        );
      }
      if (url.includes(`/api/account/partners/${cpA}/catalog/classes`)) {
        return new Response(JSON.stringify({ classes: [] }), { status: 200 });
      }
      if (url.includes(`/api/account/partners/${cpA}/catalog/products`)) {
        return new Response(
          JSON.stringify({
            products: [
              { external_product_id: 'SKU-A1', product_name: 'Widget A1', primary_class_slug: null },
              { external_product_id: 'SKU-A2', product_name: 'Widget A2', primary_class_slug: null },
            ],
            total: 2,
          }),
          { status: 200 },
        );
      }
      // cpB's catalog is intentionally never stubbed — it must stay
      // un-expanded for this test to reproduce (and then prove closed) the
      // bug. A fetch to it would mean something eagerly fanned out to every
      // scoped counterparty's catalog on mount, which this test also guards
      // against.
      throw new Error(`unexpected fetch: ${url}`);
    });

    const onChange = vi.fn();
    render(
      <BilateralCounterpartiesSkusFields
        skus={['SKU-A1', 'SKU-B1']}
        counterparties={[cpA, cpB]}
        onChange={onChange}
        universe="bilateral_connections"
      />,
    );

    // Expand ONLY cpA — cpB is never expanded, mirroring the edit route where
    // a saved scope's counterparties aren't all opened before a save.
    await userEvent.click(
      await screen.findByRole('button', { name: /expand northgate fasteners/i }),
    );
    await userEvent.click(await screen.findByRole('button', { name: /expand unclassified/i }));

    const skuRow = (await screen.findByText('Widget A2')).closest('[role="treeitem"]');
    expect(skuRow).not.toBeNull();
    const checkbox = skuRow!.querySelector('input[type="checkbox"]');
    expect(checkbox).not.toBeNull();
    await userEvent.click(checkbox as HTMLInputElement);

    await waitFor(() => {
      const last = onChange.mock.calls.at(-1)?.[0] as {
        counterparties: string[];
        skus: string[];
      };
      // SKU-B1 stays selected throughout (never touched) — its counterparty
      // (cpB, never expanded) must not be silently dropped.
      expect(last.skus).toEqual(expect.arrayContaining(['SKU-A1', 'SKU-A2', 'SKU-B1']));
      expect(last.counterparties).toEqual(expect.arrayContaining([cpA, cpB]));
    });
  });
});
