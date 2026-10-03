import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';

const { notFound } = vi.hoisted(() => ({ notFound: vi.fn(() => { throw new Error('NEXT_NOT_FOUND'); }) }));
vi.mock('next/navigation', () => ({ notFound }));
vi.mock('../[fixture]/harness', () => ({ Harness: ({ fixture }: { fixture: string }) => <p data-testid="harness">{fixture}</p> }));

import HarnessPage from '../[fixture]/page';

afterEach(() => {
  vi.unstubAllEnvs();
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

  it('renders the harness for the five fixtures with SM_HARNESS=1', async () => {
    vi.stubEnv('SM_HARNESS', '1');
    const names = ['multitier', 'throttled', 'not-traced', 'supply-risks', 'demand-exceptions'];
    for (const [i, fixture] of names.entries()) {
      render(await HarnessPage({ params: Promise.resolve({ fixture }) }));
      expect(screen.getAllByTestId('harness')[i]).toHaveTextContent(fixture);
    }
    expect(notFound).not.toHaveBeenCalled();
  });
});
