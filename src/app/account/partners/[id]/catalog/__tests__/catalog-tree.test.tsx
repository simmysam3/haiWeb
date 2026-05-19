import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CatalogTree } from '../catalog-tree';
import type { AuditScope, AuditScopeCoverage } from '@haiwave/protocol';
import type { CatalogClass, CatalogProduct } from '@/lib/haiwave-api';

const CLASSES: CatalogClass[] = [
  { class_id: 'c1', class_slug: 'bearings', class_name: 'Ball Bearings', product_count: 1 },
];
const PRODUCTS_C1: CatalogProduct[] = [
  { external_product_id: 'p1', product_name: '6201 Bearing', primary_class_slug: 'bearings' },
];

function mock(coverage: AuditScopeCoverage, scopes: AuditScope[] = []) {
  globalThis.fetch = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
    const u = typeof url === 'string' ? url : url.toString();
    const method = (init?.method ?? 'GET').toUpperCase();
    if (u.includes('/catalog/classes')) {
      return new Response(JSON.stringify({ classes: CLASSES }), { status: 200 });
    }
    if (u.includes('/audit-coverage')) {
      return new Response(JSON.stringify(coverage), { status: 200 });
    }
    if (u.includes('/audit-scopes') && method === 'POST') {
      return new Response(JSON.stringify({ scope_id: 'new' }), { status: 200 });
    }
    if (u.includes('/audit-scopes/') && method === 'DELETE') {
      return new Response(null, { status: 204 });
    }
    if (u.includes('/audit-scopes')) {
      return new Response(JSON.stringify({ scopes }), { status: 200 });
    }
    if (u.includes('/catalog/products')) {
      return new Response(JSON.stringify({ products: PRODUCTS_C1, total: 1 }), { status: 200 });
    }
    return new Response('not mocked', { status: 500 });
  }) as unknown as typeof fetch;
}

const EMPTY_COVERAGE: AuditScopeCoverage = {
  vendor_participant_id: 'v1',
  company: false,
  classes: {},
  products: {},
};

beforeEach(() => mock(EMPTY_COVERAGE));

describe('CatalogTree pill state machine', () => {
  it('uncovered class row shows Nominate link with vendor + class_id deep-link', async () => {
    render(<CatalogTree vendorId="v1" />);
    await waitFor(() => screen.getByText('Ball Bearings'));
    const link = screen.getByRole('link', { name: /nominate/i });
    expect(link).toHaveAttribute(
      'href',
      '/account/sonar/compliance/posture/nominations/new?vendor=v1&class_id=c1',
    );
  });

  it('uncovered product row shows Nominate link with vendor + product deep-link', async () => {
    render(<CatalogTree vendorId="v1" />);
    await waitFor(() => screen.getByText('Ball Bearings'));
    await userEvent.click(screen.getByText(/show products/i));
    await waitFor(() => screen.getByText('6201 Bearing'));
    const productLink = screen.getAllByRole('link', { name: /nominate/i }).at(-1)!;
    expect(productLink).toHaveAttribute(
      'href',
      '/account/sonar/compliance/posture/nominations/new?vendor=v1&product=p1',
    );
  });

  it('class with direct scope shows Active badge + inline Disable button', async () => {
    const scope: AuditScope = {
      scope_id: 's1',
      initiator_participant_id: '00000000-0000-0000-0000-000000000001',
      vendor_participant_id: 'v1',
      scope_type: 'class',
      scope_ref: 'c1',
      created_at: '2026-04-28T00:00:00Z',
      created_by_user_id: null,
      disabled_at: null,
      disabled_by_user_id: null,
    };
    mock({ ...EMPTY_COVERAGE, classes: { c1: true } }, [scope]);
    render(<CatalogTree vendorId="v1" />);
    await waitFor(() => screen.getByText('Ball Bearings'));
    expect(screen.getByText(/active/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /disable/i })).toBeInTheDocument();
  });

  it('class covered by company-wide shows inherited badge, no Disable', async () => {
    mock({ ...EMPTY_COVERAGE, company: true });
    render(<CatalogTree vendorId="v1" />);
    await waitFor(() => screen.getByText('Ball Bearings'));
    expect(screen.getByText(/covered by company-wide/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^disable$/i })).not.toBeInTheDocument();
  });

  it('product covered by class scope shows inherited badge', async () => {
    mock({ ...EMPTY_COVERAGE, classes: { c1: true } });
    render(<CatalogTree vendorId="v1" />);
    await waitFor(() => screen.getByText('Ball Bearings'));
    await userEvent.click(screen.getByText(/show products/i));
    await waitFor(() => screen.getByText('6201 Bearing'));
    expect(screen.getByText(/covered by class/i)).toBeInTheDocument();
  });

  it('Disable button on direct-scope row fires DELETE', async () => {
    const scope: AuditScope = {
      scope_id: 's1',
      initiator_participant_id: '00000000-0000-0000-0000-000000000001',
      vendor_participant_id: 'v1',
      scope_type: 'class',
      scope_ref: 'c1',
      created_at: '2026-04-28T00:00:00Z',
      created_by_user_id: null,
      disabled_at: null,
      disabled_by_user_id: null,
    };
    mock({ ...EMPTY_COVERAGE, classes: { c1: true } }, [scope]);
    render(<CatalogTree vendorId="v1" />);
    await waitFor(() => screen.getByText('Ball Bearings'));
    await userEvent.click(screen.getByRole('button', { name: /disable/i }));
    await waitFor(() =>
      expect(globalThis.fetch).toHaveBeenCalledWith(
        '/api/account/audit-scopes/s1',
        expect.objectContaining({ method: 'DELETE' }),
      ),
    );
  });

  it('company-wide top row toggle still works', async () => {
    render(<CatalogTree vendorId="v1" />);
    await waitFor(() => screen.getByText(/entire company/i));
    await userEvent.click(screen.getByLabelText(/entire company/i));
    await waitFor(() =>
      expect(globalThis.fetch).toHaveBeenCalledWith(
        '/api/account/audit-scopes',
        expect.objectContaining({ method: 'POST' }),
      ),
    );
  });

  it('class+product rows have NO checkbox (write moved to form)', async () => {
    render(<CatalogTree vendorId="v1" />);
    await waitFor(() => screen.getByText('Ball Bearings'));
    // The only checkbox should be the company-wide row.
    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes).toHaveLength(1);
  });
});
