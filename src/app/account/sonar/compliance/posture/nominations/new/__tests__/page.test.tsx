import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';

// Stub Next.js server helpers used by page.tsx.
vi.mock('next/headers', () => ({
  cookies: () => Promise.resolve({ toString: () => 'sid=test' }),
  headers: () => Promise.resolve({
    get: (name: string) => (name === 'host' ? 'localhost:3001' : null),
  }),
}));

// Stub the wizard so we only assert what initialState is passed in.
const formProps: Array<{ initialState: unknown }> = [];
vi.mock('../nomination-form', () => ({
  NominationForm: (props: { initialState: unknown }) => {
    formProps.push(props);
    return <div data-testid="form">{JSON.stringify({
      kind: (props.initialState as { kind: string }).kind,
    })}</div>;
  },
}));

import Page from '../page';

const PARTNERS = [
  { id: 'v1', company_name: 'Apex Manufacturing', status: 'trading_pair' },
];
const CLASSES = [
  { class_id: 'c1', class_slug: 'b', class_name: 'Bearings', product_count: 2 },
];
const PRODUCTS_C1 = [
  { external_product_id: 'p1', product_name: '6201', primary_class_slug: 'b' },
];

function mockEndpoints() {
  globalThis.fetch = vi.fn(async (url: RequestInfo | URL) => {
    const u = typeof url === 'string' ? url : url.toString();
    if (u.endsWith('/api/account/partners')) {
      return new Response(JSON.stringify(PARTNERS), { status: 200 });
    }
    if (u.includes('/catalog/classes')) {
      return new Response(JSON.stringify({ classes: CLASSES }), { status: 200 });
    }
    if (u.includes('/catalog/products')) {
      return new Response(JSON.stringify({ products: PRODUCTS_C1, total: 1 }), { status: 200 });
    }
    return new Response('not mocked', { status: 404 });
  }) as unknown as typeof fetch;
}

beforeEach(() => {
  formProps.length = 0;
  mockEndpoints();
});

describe('NominationsNewPage (server)', () => {
  it('returns cold initial state when no params provided', async () => {
    const ui = await Page({ searchParams: Promise.resolve({}) });
    render(ui);
    expect(formProps[0].initialState).toMatchObject({ kind: 'cold' });
  });

  it('returns cold + error for unknown vendor', async () => {
    const ui = await Page({ searchParams: Promise.resolve({ vendor: 'INVALID' }) });
    render(ui);
    expect(formProps[0].initialState).toMatchObject({ kind: 'cold' });
    expect((formProps[0].initialState as { error?: string }).error).toMatch(/find that vendor/i);
  });

  it('returns vendor state for valid vendor only', async () => {
    const ui = await Page({ searchParams: Promise.resolve({ vendor: 'v1' }) });
    render(ui);
    expect(formProps[0].initialState).toMatchObject({ kind: 'vendor' });
  });

  it('returns vendor+class state for valid vendor + class_id', async () => {
    const ui = await Page({ searchParams: Promise.resolve({ vendor: 'v1', class_id: 'c1' }) });
    render(ui);
    expect(formProps[0].initialState).toMatchObject({ kind: 'vendor+class' });
  });

  it('falls back to vendor + error for invalid class_id', async () => {
    const ui = await Page({ searchParams: Promise.resolve({ vendor: 'v1', class_id: 'BOGUS' }) });
    render(ui);
    expect(formProps[0].initialState).toMatchObject({ kind: 'vendor' });
    expect((formProps[0].initialState as { error?: string }).error).toMatch(/class.*not found/i);
  });

  it('returns vendor+product state for valid vendor + product', async () => {
    const ui = await Page({ searchParams: Promise.resolve({ vendor: 'v1', product: 'p1' }) });
    render(ui);
    expect(formProps[0].initialState).toMatchObject({ kind: 'vendor+product' });
  });

  it('falls back to vendor + error for invalid product', async () => {
    const ui = await Page({ searchParams: Promise.resolve({ vendor: 'v1', product: 'BOGUS' }) });
    render(ui);
    expect(formProps[0].initialState).toMatchObject({ kind: 'vendor' });
    expect((formProps[0].initialState as { error?: string }).error).toMatch(/product.*not found/i);
  });

  it('treats class_id as authoritative when both class_id and product are present', async () => {
    const ui = await Page({
      searchParams: Promise.resolve({ vendor: 'v1', class_id: 'c1', product: 'p1' }),
    });
    render(ui);
    expect(formProps[0].initialState).toMatchObject({ kind: 'vendor+class' });
  });
});
