import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { leonExceptions } from '@/app/sourcing-map/__fixtures__/sp3';

const { fetchBffJson } = vi.hoisted(() => ({ fetchBffJson: vi.fn() }));
vi.mock('@/lib/server-fetch', () => ({ fetchBffJson }));

vi.mock('next/headers', () => ({
  cookies: () => Promise.resolve({ toString: () => 'session=abc' }),
  headers: () => Promise.resolve(new Map() as unknown as Headers),
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/account/sonar/demand-exceptions',
  useSearchParams: () => new URLSearchParams(),
}));

import DemandExceptionsPage from '../page';

function wire(): URLSearchParams {
  const [path] = fetchBffJson.mock.calls[0] as [string];
  expect(path.startsWith('/api/account/sourcing-map/demand-exceptions?')).toBe(true);
  return new URL(path, 'http://bff').searchParams;
}

describe('Demand Exceptions page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchBffJson.mockResolvedValue({ kind: 'ok', data: leonExceptions });
  });

  it('asks for all three causes when the cause is unknown (fail closed)', async () => {
    render(await DemandExceptionsPage({ searchParams: Promise.resolve({ cause: 'query_guard' }) }));
    expect(wire().getAll('cause')).toEqual(['own_capacity', 'chain', 'posture']);
  });

  it('asks only for the requested cause', async () => {
    render(await DemandExceptionsPage({ searchParams: Promise.resolve({ cause: 'chain' }) }));
    expect(wire().getAll('cause')).toEqual(['chain']);
  });

  it('forwards the cursor', async () => {
    render(await DemandExceptionsPage({ searchParams: Promise.resolve({ cursor: 'c1' }) }));
    expect(wire().get('cursor')).toBe('c1');
  });

  it('renders the header, the standing line and the table', async () => {
    render(await DemandExceptionsPage({ searchParams: Promise.resolve({}) }));
    expect(screen.getByRole('heading', { name: 'Demand Exceptions' })).toBeInTheDocument();
    expect(screen.getByText('Planning probes — answers are not commitments.')).toBeInTheDocument();
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Chain' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('shows the error line and no table on a 403', async () => {
    fetchBffJson.mockResolvedValue({ kind: 'error', status: 403, message: 'no' });
    render(await DemandExceptionsPage({ searchParams: Promise.resolve({}) }));
    expect(screen.getByRole('alert').textContent).toBe('You do not have permission to view demand exceptions.');
    expect(screen.queryByRole('table')).toBeNull();
  });
});
