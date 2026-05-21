import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CatalogStep } from '../catalog-step';
import type { AuditScopeCoverage } from '@haiwave/protocol';
import type { CatalogClass, CatalogProduct } from '@/lib/haiwave-api';

const CLASSES: CatalogClass[] = [
  { class_id: 'c1', class_slug: 'bearings', class_name: 'Ball Bearings', product_count: 2 },
  { class_id: 'c2', class_slug: 'fasteners', class_name: 'Fasteners', product_count: 1 },
];

const PRODUCTS_C1: CatalogProduct[] = [
  { external_product_id: 'p1', product_name: '6201-2RS Bearing', primary_class_slug: 'bearings' },
  { external_product_id: 'p2', product_name: '6202-2RS Bearing', primary_class_slug: 'bearings' },
];

const COVERAGE_EMPTY: AuditScopeCoverage = {
  vendor_participant_id: 'v1',
  company: false,
  classes: {},
  products: {},
};

function mockTriplet(coverage: AuditScopeCoverage = COVERAGE_EMPTY) {
  globalThis.fetch = vi.fn(async (url: RequestInfo | URL) => {
    const u = typeof url === 'string' ? url : url.toString();
    if (u.includes('/catalog/classes')) {
      return new Response(JSON.stringify({ classes: CLASSES }), { status: 200 });
    }
    if (u.includes('/audit-coverage')) {
      return new Response(JSON.stringify(coverage), { status: 200 });
    }
    if (u.includes('/audit-scopes')) {
      return new Response(JSON.stringify({ scopes: [] }), { status: 200 });
    }
    if (u.includes('/catalog/products')) {
      return new Response(JSON.stringify({ products: PRODUCTS_C1, total: 2 }), { status: 200 });
    }
    return new Response('not mocked', { status: 500 });
  }) as unknown as typeof fetch;
}

beforeEach(() => mockTriplet());

describe('CatalogStep', () => {
  it('renders classes after fetch', async () => {
    render(
      <CatalogStep
        vendor={{ id: 'v1', legal_name: 'Apex' }}
        selections={{ classes: new Set(), products: new Set() }}
        onChange={() => {}}
        onAdvance={() => {}}
        onBack={() => {}}
      />,
    );
    await waitFor(() => expect(screen.getByText('Ball Bearings')).toBeInTheDocument());
    expect(screen.getByText('Fasteners')).toBeInTheDocument();
  });

  it('toggles a class checkbox into the selections set', async () => {
    const onChange = vi.fn();
    render(
      <CatalogStep
        vendor={{ id: 'v1', legal_name: 'Apex' }}
        selections={{ classes: new Set(), products: new Set() }}
        onChange={onChange}
        onAdvance={() => {}}
        onBack={() => {}}
      />,
    );
    await waitFor(() => screen.getByText('Ball Bearings'));
    await userEvent.click(screen.getByLabelText('Ball Bearings'));
    expect(onChange).toHaveBeenCalled();
    const next = onChange.mock.calls.at(-1)![0];
    expect(next.classes.has('c1')).toBe(true);
  });

  it('disables product checkboxes when their class is selected', async () => {
    render(
      <CatalogStep
        vendor={{ id: 'v1', legal_name: 'Apex' }}
        selections={{ classes: new Set(['c1']), products: new Set() }}
        onChange={() => {}}
        onAdvance={() => {}}
        onBack={() => {}}
      />,
    );
    await waitFor(() => screen.getByText('Ball Bearings'));
    await userEvent.click(screen.getAllByText(/show products/i)[0]);
    await waitFor(() => screen.getByText('6201-2RS Bearing'));
    const productCheckbox = screen.getByLabelText('6201-2RS Bearing');
    expect(productCheckbox).toBeDisabled();
  });

  it('marks already-covered classes disabled with badge', async () => {
    mockTriplet({ ...COVERAGE_EMPTY, classes: { c1: true } });
    render(
      <CatalogStep
        vendor={{ id: 'v1', legal_name: 'Apex' }}
        selections={{ classes: new Set(), products: new Set() }}
        onChange={() => {}}
        onAdvance={() => {}}
        onBack={() => {}}
      />,
    );
    await waitFor(() => screen.getByText('Ball Bearings'));
    expect(screen.getByLabelText('Ball Bearings')).toBeDisabled();
    expect(screen.getByText(/already nominated/i)).toBeInTheDocument();
  });

  it('disables Continue when nothing is selected', async () => {
    render(
      <CatalogStep
        vendor={{ id: 'v1', legal_name: 'Apex' }}
        selections={{ classes: new Set(), products: new Set() }}
        onChange={() => {}}
        onAdvance={() => {}}
        onBack={() => {}}
      />,
    );
    await waitFor(() => screen.getByText('Ball Bearings'));
    expect(screen.getByRole('button', { name: /continue/i })).toBeDisabled();
  });

  it('enables Continue and calls onAdvance when at least one selection exists', async () => {
    const onAdvance = vi.fn();
    render(
      <CatalogStep
        vendor={{ id: 'v1', legal_name: 'Apex' }}
        selections={{ classes: new Set(['c1']), products: new Set() }}
        onChange={() => {}}
        onAdvance={onAdvance}
        onBack={() => {}}
      />,
    );
    await waitFor(() => screen.getByText('Ball Bearings'));
    const continueBtn = screen.getByRole('button', { name: /continue/i });
    expect(continueBtn).not.toBeDisabled();
    await userEvent.click(continueBtn);
    expect(onAdvance).toHaveBeenCalled();
  });
});
