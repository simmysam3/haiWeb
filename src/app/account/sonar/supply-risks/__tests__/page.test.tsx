import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { supplyRisksList, riskOf } from '@/app/sourcing-map/__fixtures__/sp3';

const { fetchBffJson } = vi.hoisted(() => ({ fetchBffJson: vi.fn() }));
vi.mock('@/lib/server-fetch', () => ({ fetchBffJson }));

vi.mock('next/headers', () => ({
  cookies: () => Promise.resolve({ toString: () => 'session=abc' }),
  headers: () => Promise.resolve(new Map() as unknown as Headers),
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/account/sonar/supply-risks',
  useSearchParams: () => new URLSearchParams(),
}));

import SupplyRisksPage from '../page';

function wire(): URLSearchParams {
  const [path] = fetchBffJson.mock.calls[0] as [string];
  expect(path.startsWith('/api/account/sourcing-map/supply-risks?')).toBe(true);
  return new URL(path, 'http://bff').searchParams;
}

describe('Supply Risks page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchBffJson.mockResolvedValue({ kind: 'ok', data: supplyRisksList });
  });

  it('asks for the active statuses when none is requested (G-15)', async () => {
    render(await SupplyRisksPage({ searchParams: Promise.resolve({}) }));
    expect(wire().getAll('status')).toEqual(['open', 'contacted', 'resolving']);
  });

  it('falls back to the active statuses when the only requested one is unknown', async () => {
    render(await SupplyRisksPage({ searchParams: Promise.resolve({ status: 'zz' }) }));
    expect(wire().getAll('status')).toEqual(['open', 'contacted', 'resolving']);
  });

  it('keeps the known statuses and drops the unknown ones', async () => {
    render(await SupplyRisksPage({ searchParams: Promise.resolve({ status: ['resolved', 'zz'] }) }));
    expect(wire().getAll('status')).toEqual(['resolved']);
  });

  it('forwards the cursor', async () => {
    render(await SupplyRisksPage({ searchParams: Promise.resolve({ cursor: 'c1' }) }));
    expect(wire().get('cursor')).toBe('c1');
  });

  it('shows the error line and no table on a 403', async () => {
    fetchBffJson.mockResolvedValue({ kind: 'error', status: 403, message: 'no' });
    render(await SupplyRisksPage({ searchParams: Promise.resolve({}) }));
    expect(screen.getByRole('alert').textContent).toBe('You do not have permission to view supply risks.');
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('renders the table and presses the resolved default statuses', async () => {
    render(await SupplyRisksPage({ searchParams: Promise.resolve({}) }));
    expect(screen.getByRole('table')).toBeInTheDocument();
    for (const name of ['Open', 'Contacted', 'Resolving']) {
      expect(screen.getByRole('button', { name })).toHaveAttribute('aria-pressed', 'true');
    }
    for (const name of ['Resolved', 'Accepted']) {
      expect(screen.getByRole('button', { name })).toHaveAttribute('aria-pressed', 'false');
    }
  });

  it('re-seeds the rows when the query changes (the table key)', async () => {
    const view = render(await SupplyRisksPage({ searchParams: Promise.resolve({}) }));
    expect(screen.getByText('León Cuero')).toBeInTheDocument();
    fetchBffJson.mockResolvedValue({
      kind: 'ok',
      data: { risks: [riskOf({ risk_id: 'older-1', supplier_name: 'Older Mills' })], open_count: 1, next_cursor: null },
    });
    view.rerender(await SupplyRisksPage({ searchParams: Promise.resolve({ cursor: 'c2' }) }));
    expect(screen.getByText('Older Mills')).toBeInTheDocument();
    expect(screen.queryByText('León Cuero')).toBeNull();
  });
});
