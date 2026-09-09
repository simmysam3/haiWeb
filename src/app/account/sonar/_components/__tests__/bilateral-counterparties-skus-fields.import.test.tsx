import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  BilateralCounterpartiesSkusFields,
  type ImportResult,
} from '../bilateral-counterparties-skus-fields';

afterEach(() => vi.unstubAllGlobals());

const PW = 'cccccccc-0000-0000-0000-000000000002';

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
