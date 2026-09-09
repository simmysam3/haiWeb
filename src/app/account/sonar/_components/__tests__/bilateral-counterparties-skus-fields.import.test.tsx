import { useState } from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  BilateralCounterpartiesSkusFields,
  type ImportResult,
} from '../bilateral-counterparties-skus-fields';

afterEach(() => vi.unstubAllGlobals());

const PW = 'cccccccc-0000-0000-0000-000000000002';
const THALES = 'cccccccc-0000-0000-0000-000000000003';

/**
 * Stubs partners (bilateral) / wizard-options (audit) + P&W's catalog:
 * two classes, four SKUs. `accepted` narrows the audit universe's product_ids.
 */
function stubFetch(opts: { accepted?: string[]; catalogFails?: boolean } = {}) {
  const products = [
    { external_product_id: '5328285', product_name: 'EEC FCS6.0', primary_class_slug: 'engine-control' },
    { external_product_id: '5331092', product_name: 'EEC FCS6.2', primary_class_slug: 'engine-control' },
    { external_product_id: '3957985205', product_name: 'EIU', primary_class_slug: 'airframe-interface' },
    { external_product_id: '271-200-025-026', product_name: 'Accelerometer', primary_class_slug: null },
  ];
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
  const fetchMock = vi.fn(async (input: string) => {
    const url = new URL(String(input), 'http://localhost');
    if (url.pathname === '/api/account/partners') {
      return json([{ id: PW, company_name: 'Pratt & Whitney (Demo)', status: 'trading_pair' }]);
    }
    if (url.pathname.endsWith('/audit/wizard-options')) {
      return json({
        counterparties: [
          {
            counterparty_id: PW,
            counterparty_legal_name: 'Pratt & Whitney (Demo)',
            product_ids: opts.accepted ?? products.map((p) => p.external_product_id),
          },
        ],
      });
    }
    if (url.pathname.endsWith('/catalog/classes')) {
      if (opts.catalogFails) return json({ error: 'boom' }, 502);
      return json({
        classes: [
          { class_id: 'c1', class_slug: 'engine-control', class_name: 'Engine Control', product_count: 2 },
          { class_id: 'c2', class_slug: 'airframe-interface', class_name: 'Airframe Interface', product_count: 1 },
        ],
      });
    }
    if (url.pathname.endsWith('/catalog/products')) {
      if (opts.catalogFails) return json({ error: 'boom' }, 502);
      return json({ products, total: products.length });
    }
    throw new Error(`unexpected fetch ${url.pathname}`);
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('BilateralCounterpartiesSkusFields — onOptionsLoaded', () => {
  it('reports the loaded universe once so a caller can offer it without a second request', async () => {
    const fetchMock = stubFetch();
    const onOptionsLoaded = vi.fn();
    render(
      <BilateralCounterpartiesSkusFields
        skus={[]}
        onChange={() => {}}
        universe="bilateral_connections"
        onOptionsLoaded={onOptionsLoaded}
      />,
    );
    await screen.findByRole('button', { name: /Pratt & Whitney/ });
    expect(onOptionsLoaded).toHaveBeenCalledTimes(1);
    expect(onOptionsLoaded).toHaveBeenCalledWith([
      { counterparty_id: PW, counterparty_legal_name: 'Pratt & Whitney (Demo)' },
    ]);
    // The universe request happened exactly once.
    expect(fetchMock.mock.calls.filter(([u]) => String(u) === '/api/account/partners')).toHaveLength(1);
  });
});

type Emitted = { counterparties: string[]; skus: string[]; sku_asks: unknown[] };

/** Controlled harness: feeds onChange back into `skus` the way the wizards do. */
function Harness(props: {
  universe: 'bilateral_connections' | 'accepted_audit_scopes';
  importRequest: { id: number; counterpartyId: string; skus: string[] } | null;
  onImportResult?: (r: ImportResult) => void;
  onEmit: (e: Emitted) => void;
  initialSkus?: string[];
}) {
  const [skus, setSkus] = useState<string[]>(props.initialSkus ?? []);
  return (
    <BilateralCounterpartiesSkusFields
      skus={skus}
      universe={props.universe}
      importRequest={props.importRequest}
      onImportResult={props.onImportResult}
      onChange={(e) => {
        setSkus(e.skus);
        props.onEmit(e);
      }}
    />
  );
}

describe('BilateralCounterpartiesSkusFields — importRequest', () => {
  it('checks the matched SKUs and emits the same payload a manual click sequence emits', async () => {
    // Manual control: click the two EEC SKUs by hand.
    stubFetch();
    const manual: Emitted[] = [];
    const m = render(<Harness universe="bilateral_connections" importRequest={null} onEmit={(e) => manual.push(e)} />);
    fireEvent.click(await screen.findByRole('button', { name: /Pratt & Whitney/ }));
    fireEvent.click(await screen.findByRole('button', { name: /Engine Control/ }));
    const boxes = await screen.findAllByRole('checkbox');
    const eec1 = boxes.find((b) => b.closest('li, div')?.textContent?.includes('5328285'));
    const eec2 = boxes.find((b) => b.closest('li, div')?.textContent?.includes('5331092'));
    if (!eec1 || !eec2) throw new Error('SKU checkboxes not found');
    fireEvent.click(eec1);
    fireEvent.click(eec2);
    const manualLast = manual[manual.length - 1];
    expect(manualLast.skus).toEqual(['5328285', '5331092']);
    m.unmount();
    vi.unstubAllGlobals();

    // Import: same two SKUs, plus one the file has and the catalog does not.
    stubFetch();
    const imported: Emitted[] = [];
    const results: ImportResult[] = [];
    render(
      <Harness
        universe="bilateral_connections"
        importRequest={{ id: 1, counterpartyId: PW, skus: ['5328285', '5331092', 'NOT-IN-CATALOG'] }}
        onImportResult={(r) => results.push(r)}
        onEmit={(e) => imported.push(e)}
      />,
    );
    await waitFor(() => expect(results).toHaveLength(1));
    expect(results[0]).toEqual({
      id: 1,
      counterpartyId: PW,
      matched: ['5328285', '5331092'],
      notInCatalog: ['NOT-IN-CATALOG'],
      notAccepted: [],
    });
    expect(imported[imported.length - 1]).toEqual(manualLast);
    // The counterparty and the class holding the matches are expanded, and the boxes are checked.
    const checked = (await screen.findAllByRole('checkbox')).filter((b) => (b as HTMLInputElement).checked);
    expect(checked.length).toBeGreaterThanOrEqual(2);
  });

  it('under the audit universe reports SKUs in the catalog but outside the accepted scope, and does not check them', async () => {
    stubFetch({ accepted: ['5328285'] });
    const results: ImportResult[] = [];
    const emitted: Emitted[] = [];
    render(
      <Harness
        universe="accepted_audit_scopes"
        importRequest={{ id: 2, counterpartyId: PW, skus: ['5328285', '5331092', 'ZZZ'] }}
        onImportResult={(r) => results.push(r)}
        onEmit={(e) => emitted.push(e)}
      />,
    );
    await waitFor(() => expect(results).toHaveLength(1));
    expect(results[0]).toMatchObject({ matched: ['5328285'], notAccepted: ['5331092'], notInCatalog: ['ZZZ'] });
    expect(emitted[emitted.length - 1].skus).toEqual(['5328285']);
  });

  it('adds to an existing selection rather than replacing it', async () => {
    stubFetch();
    const emitted: Emitted[] = [];
    const results: ImportResult[] = [];
    render(
      <Harness
        universe="bilateral_connections"
        initialSkus={['271-200-025-026']}
        importRequest={{ id: 3, counterpartyId: PW, skus: ['3957985205'] }}
        onImportResult={(r) => results.push(r)}
        onEmit={(e) => emitted.push(e)}
      />,
    );
    await waitFor(() => expect(results).toHaveLength(1));
    expect(emitted[emitted.length - 1].skus.sort()).toEqual(['271-200-025-026', '3957985205']);
  });

  it('reports a catalog failure and checks nothing', async () => {
    stubFetch({ catalogFails: true });
    const emitted: Emitted[] = [];
    const results: ImportResult[] = [];
    render(
      <Harness
        universe="bilateral_connections"
        importRequest={{ id: 4, counterpartyId: PW, skus: ['5328285'] }}
        onImportResult={(r) => results.push(r)}
        onEmit={(e) => emitted.push(e)}
      />,
    );
    await waitFor(() => expect(results).toHaveLength(1));
    expect(results[0].error).toBeTruthy();
    expect(results[0].matched).toEqual([]);
    expect(emitted).toHaveLength(0);
  });

  it('settles every queued request when a second arrives while the first catalog is still loading', async () => {
    // Two counterparties. GLB's products fetch is held open, so its catalog is
    // still `loading` when the second request (for PW) arrives.
    const GLB = 'cccccccc-0000-0000-0000-000000000003';
    let releaseGlb: () => void = () => {};
    const glbGate = new Promise<void>((resolve) => {
      releaseGlb = resolve;
    });
    const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
    const fetchMock = vi.fn(async (input: string) => {
      const url = new URL(String(input), 'http://localhost');
      if (url.pathname === '/api/account/partners') {
        return json([
          { id: GLB, company_name: 'Great Lakes Bearing (Demo)', status: 'trading_pair' },
          { id: PW, company_name: 'Pratt & Whitney (Demo)', status: 'trading_pair' },
        ]);
      }
      if (url.pathname.endsWith('/catalog/classes')) {
        return json({
          classes: [
            { class_id: 'c1', class_slug: 'engine-control', class_name: 'Engine Control', product_count: 2 },
            { class_id: 'c2', class_slug: 'bearings', class_name: 'Bearings', product_count: 1 },
          ],
        });
      }
      if (url.pathname.endsWith('/catalog/products')) {
        if (url.pathname.includes(GLB)) {
          // Deferred, not timed: the test decides when this catalog lands.
          await glbGate;
          return json({
            products: [{ external_product_id: 'GLB-77', product_name: 'Roller Bearing', primary_class_slug: 'bearings' }],
            total: 1,
          });
        }
        return json({
          products: [
            { external_product_id: '5328285', product_name: 'EEC FCS6.0', primary_class_slug: 'engine-control' },
            { external_product_id: '5331092', product_name: 'EEC FCS6.2', primary_class_slug: 'engine-control' },
          ],
          total: 2,
        });
      }
      throw new Error(`unexpected fetch ${url.pathname}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    const results: ImportResult[] = [];
    const emitted: Emitted[] = [];
    const { rerender } = render(
      <Harness
        universe="bilateral_connections"
        importRequest={{ id: 10, counterpartyId: GLB, skus: ['GLB-77'] }}
        onImportResult={(r) => results.push(r)}
        onEmit={(e) => emitted.push(e)}
      />,
    );
    // The first request is genuinely in flight before the second is issued.
    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(
          ([u]) => String(u).includes(GLB) && String(u).includes('/catalog/products'),
        ),
      ).toBe(true),
    );
    expect(results).toHaveLength(0);

    rerender(
      <Harness
        universe="bilateral_connections"
        importRequest={{ id: 11, counterpartyId: PW, skus: ['5328285', '5331092'] }}
        onImportResult={(r) => results.push(r)}
        onEmit={(e) => emitted.push(e)}
      />,
    );
    // The second counterparty's catalog resolves immediately and settles.
    await waitFor(() => expect(results.map((r) => r.id)).toContain(11));

    releaseGlb();
    // The first request must still settle — a later request must not drop it.
    await waitFor(() => expect(results).toHaveLength(2));
    expect(results.find((r) => r.id === 10)).toEqual({
      id: 10,
      counterpartyId: GLB,
      matched: ['GLB-77'],
      notInCatalog: [],
      notAccepted: [],
    });
    expect(results.find((r) => r.id === 11)).toEqual({
      id: 11,
      counterpartyId: PW,
      matched: ['5328285', '5331092'],
      notInCatalog: [],
      notAccepted: [],
    });
    // Both counterparties' SKUs survive in the emitted scope.
    const last = emitted[emitted.length - 1];
    expect([...last.skus].sort()).toEqual(['5328285', '5331092', 'GLB-77']);
    expect([...last.counterparties].sort()).toEqual([GLB, PW].sort());
  });

  it('settles two requests for the SAME counterparty against its one catalog, keeping both SKU sets', async () => {
    // Both requests queue before the single catalog resolves, so both settle in
    // one pass — the case where the applied SKUs must be unioned rather than
    // written twice from the same render's selection.
    const GLB = 'cccccccc-0000-0000-0000-000000000003';
    let releaseGlb: () => void = () => {};
    const glbGate = new Promise<void>((resolve) => {
      releaseGlb = resolve;
    });
    const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
    const fetchMock = vi.fn(async (input: string) => {
      const url = new URL(String(input), 'http://localhost');
      if (url.pathname === '/api/account/partners') {
        return json([{ id: GLB, company_name: 'Great Lakes Bearing (Demo)', status: 'trading_pair' }]);
      }
      if (url.pathname.endsWith('/catalog/classes')) {
        return json({
          classes: [{ class_id: 'c2', class_slug: 'bearings', class_name: 'Bearings', product_count: 2 }],
        });
      }
      if (url.pathname.endsWith('/catalog/products')) {
        await glbGate;
        return json({
          products: [
            { external_product_id: 'GLB-77', product_name: 'Roller Bearing', primary_class_slug: 'bearings' },
            { external_product_id: 'GLB-88', product_name: 'Thrust Bearing', primary_class_slug: 'bearings' },
          ],
          total: 2,
        });
      }
      throw new Error(`unexpected fetch ${url.pathname}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    const results: ImportResult[] = [];
    const emitted: Emitted[] = [];
    const { rerender } = render(
      <Harness
        universe="bilateral_connections"
        importRequest={{ id: 20, counterpartyId: GLB, skus: ['GLB-77'] }}
        onImportResult={(r) => results.push(r)}
        onEmit={(e) => emitted.push(e)}
      />,
    );
    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(([u]) => String(u).includes('/catalog/products')),
      ).toBe(true),
    );
    rerender(
      <Harness
        universe="bilateral_connections"
        importRequest={{ id: 21, counterpartyId: GLB, skus: ['GLB-88', 'NOPE'] }}
        onImportResult={(r) => results.push(r)}
        onEmit={(e) => emitted.push(e)}
      />,
    );
    expect(results).toHaveLength(0);

    releaseGlb();
    await waitFor(() => expect(results).toHaveLength(2));
    // Arrival order, each against the one catalog.
    expect(results.map((r) => r.id)).toEqual([20, 21]);
    expect(results[0]).toEqual({
      id: 20,
      counterpartyId: GLB,
      matched: ['GLB-77'],
      notInCatalog: [],
      notAccepted: [],
    });
    expect(results[1]).toEqual({
      id: 21,
      counterpartyId: GLB,
      matched: ['GLB-88'],
      notInCatalog: ['NOPE'],
      notAccepted: [],
    });
    // Neither request's SKUs are lost to the other.
    expect([...emitted[emitted.length - 1].skus].sort()).toEqual(['GLB-77', 'GLB-88']);
  });
});

describe('BilateralCounterpartiesSkusFields — a queued request whose counterparty leaves the universe', () => {
  it('settles it with not_a_counterparty instead of dropping it silently', async () => {
    // The catalog load is held open so the request is still QUEUED when the
    // universe changes under it — the only way to reach the second effect's
    // missing-counterparty branch.
    const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
    let releaseCatalog: () => void = () => {};
    const catalogGate = new Promise<void>((resolve) => {
      releaseCatalog = resolve;
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string) => {
        const url = new URL(String(input), 'http://localhost');
        if (url.pathname === '/api/account/partners') {
          return json([{ id: PW, company_name: 'Pratt & Whitney (Demo)', status: 'trading_pair' }]);
        }
        if (url.pathname.endsWith('/audit/wizard-options')) {
          // A different universe entirely: P&W is not in it.
          return json({
            counterparties: [
              { counterparty_id: THALES, counterparty_legal_name: 'Thales Avionics (Demo)', product_ids: [] },
            ],
          });
        }
        if (url.pathname.endsWith('/catalog/classes')) return json({ classes: [] });
        if (url.pathname.endsWith('/catalog/products')) {
          await catalogGate;
          return json({ products: [], total: 0 });
        }
        throw new Error(`unexpected fetch ${url.pathname}`);
      }),
    );

    const request = { id: 7, counterpartyId: PW, skus: ['5328285', '5331092'] };
    const results: ImportResult[] = [];
    const view = render(
      <Harness
        universe="bilateral_connections"
        importRequest={request}
        onImportResult={(r) => results.push(r)}
        onEmit={() => {}}
      />,
    );
    // Queued, and P&W's catalog is still loading.
    await screen.findByRole('button', { name: /Pratt & Whitney/ });

    view.rerender(
      <Harness
        universe="accepted_audit_scopes"
        importRequest={request}
        onImportResult={(r) => results.push(r)}
        onEmit={() => {}}
      />,
    );
    await screen.findByRole('button', { name: /Thales/ });

    await act(async () => {
      releaseCatalog();
      await new Promise((r) => setTimeout(r, 20));
    });

    await waitFor(() => expect(results).toHaveLength(1));
    expect(results[0]).toEqual({
      id: 7,
      counterpartyId: PW,
      matched: [],
      notInCatalog: ['5328285', '5331092'],
      notAccepted: [],
      error: 'not_a_counterparty',
    });
  });
});
