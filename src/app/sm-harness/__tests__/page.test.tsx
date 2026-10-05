import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { vomeroEstimate } from '@/lib/sourcing-map/__fixtures__/vomero';

const { notFound } = vi.hoisted(() => ({ notFound: vi.fn(() => { throw new Error('NEXT_NOT_FOUND'); }) }));
vi.mock('next/navigation', () => ({
  notFound,
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/sm-harness/supply-risks',
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock('../[fixture]/harness', () => ({ Harness: ({ fixture }: { fixture: string }) => <p data-testid="harness">{fixture}</p> }));

import HarnessPage from '../[fixture]/page';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  notFound.mockClear();
});

describe('/sm-harness/[fixture] (plan Task 13)', () => {
  it('is a 404 unless the server runs with SM_HARNESS=1, and for any fixture it does not know', async () => {
    vi.stubEnv('SM_HARNESS', '');
    await expect(HarnessPage({ params: Promise.resolve({ fixture: 'multitier' }) })).rejects.toThrow('NEXT_NOT_FOUND');
    vi.stubEnv('SM_HARNESS', '1');
    await expect(HarnessPage({ params: Promise.resolve({ fixture: 'nope' }) })).rejects.toThrow('NEXT_NOT_FOUND');
    expect(notFound).toHaveBeenCalledTimes(2);
  });

  it('is a 404 under a production server even with SM_HARNESS=1 (M-5)', async () => {
    vi.stubEnv('SM_HARNESS', '1');
    vi.stubEnv('NODE_ENV', 'production');
    await expect(HarnessPage({ params: Promise.resolve({ fixture: 'multitier' }) })).rejects.toThrow('NEXT_NOT_FOUND');
    expect(notFound).toHaveBeenCalledTimes(1);
  });

  it('renders the harness for the six fixtures with SM_HARNESS=1', async () => {
    vi.stubEnv('SM_HARNESS', '1');
    const names = ['multitier', 'throttled', 'not-traced', 'supply-risks', 'demand-exceptions', 'compare'];
    for (const [i, fixture] of names.entries()) {
      render(await HarnessPage({ params: Promise.resolve({ fixture }) }));
      expect(screen.getAllByTestId('harness')[i]).toHaveTextContent(fixture);
    }
    expect(notFound).not.toHaveBeenCalled();
  });

  it('mounts the two backlog tables on the account page\'s grey ground, with the seat\'s users, so axe measures what ships (I-2)', async () => {
    const { Harness } = await vi.importActual<typeof import('../[fixture]/harness')>('../[fixture]/harness');
    for (const fixture of ['supply-risks', 'demand-exceptions'] as const) {
      const { unmount } = render(<Harness fixture={fixture} />);
      const ground = screen.getByTestId('sp3-harness');
      expect(ground).toHaveClass('bg-light-gray');
      expect(ground).toContainElement(screen.getByRole('table'));
      if (fixture === 'supply-risks') expect(screen.getAllByRole('combobox', { name: /^Owner for / }).length).toBeGreaterThan(0);
      unmount();
    }
  });

  it('serves the compare fixture at compare: FlowKnit’s card offers "Select to trace"', async () => {
    // the workspace reads the run's estimate on mount
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, text: async () => JSON.stringify(vomeroEstimate) })));
    const { Harness } = await vi.importActual<typeof import('../[fixture]/harness')>('../[fixture]/harness');
    render(<Harness fixture="compare" />);
    const card = (await screen.findByRole('button', { name: /^FlowKnit Mills/ })).closest('article')!;
    expect(within(card).getByText('Select to trace')).toBeInTheDocument();
  });
});
