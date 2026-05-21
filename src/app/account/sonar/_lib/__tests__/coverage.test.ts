import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * v1.37 polish — shared `loadCoverage()` loader. Asserts the loader hits
 * the two canonical coverage paths in lockstep and returns both lanes as
 * `FetchResult<T>` so each caller can pick its own failure mode.
 *
 * Hoist the `fetchBffJson` mock factory so the module under test picks it
 * up at import time.
 */
const { fetchBffJson } = vi.hoisted(() => ({ fetchBffJson: vi.fn() }));

vi.mock('@/lib/server-fetch', () => ({ fetchBffJson }));

import { loadCoverage } from '../coverage';

beforeEach(() => {
  fetchBffJson.mockReset();
});

describe('loadCoverage()', () => {
  it('calls both coverage endpoints exactly once', async () => {
    fetchBffJson
      .mockResolvedValueOnce({ kind: 'ok', data: { snapshot: null } })
      .mockResolvedValueOnce({ kind: 'ok', data: { points: [] } });

    await loadCoverage();

    expect(fetchBffJson).toHaveBeenCalledTimes(2);
    expect(fetchBffJson).toHaveBeenNthCalledWith(
      1,
      '/api/account/sonar/compliance/coverage/current',
    );
    expect(fetchBffJson).toHaveBeenNthCalledWith(
      2,
      '/api/account/sonar/compliance/coverage/trend',
    );
  });

  it('returns both lanes as FetchResult — current ok, trend ok', async () => {
    const snap = { snapshot: { snapshot_id: 'x', complete_pct: 50 } };
    const trend = { points: [], window_days: 90, clamped: false };
    fetchBffJson
      .mockResolvedValueOnce({ kind: 'ok', data: snap })
      .mockResolvedValueOnce({ kind: 'ok', data: trend });

    const result = await loadCoverage();

    expect(result.current.kind).toBe('ok');
    expect(result.trend.kind).toBe('ok');
    if (result.current.kind === 'ok') expect(result.current.data).toEqual(snap);
    if (result.trend.kind === 'ok') expect(result.trend.data).toEqual(trend);
  });

  it('preserves the error lane independently — current error, trend ok', async () => {
    fetchBffJson
      .mockResolvedValueOnce({ kind: 'error', status: 500, message: 'boom' })
      .mockResolvedValueOnce({ kind: 'ok', data: { points: [], window_days: 90, clamped: false } });

    const result = await loadCoverage();

    expect(result.current.kind).toBe('error');
    expect(result.trend.kind).toBe('ok');
    if (result.current.kind === 'error') {
      expect(result.current.status).toBe(500);
      expect(result.current.message).toBe('boom');
    }
  });

  it('runs the two fetches in parallel (Promise.all)', async () => {
    // If `loadCoverage` awaited sequentially, the second call would only
    // start AFTER the first resolved. By resolving the first deferred and
    // asserting both calls happened before then, we prove parallelism.
    let resolveFirst!: (v: unknown) => void;
    const firstPending = new Promise((r) => { resolveFirst = r; });
    fetchBffJson
      .mockReturnValueOnce(firstPending)
      .mockResolvedValueOnce({ kind: 'ok', data: { points: [], window_days: 90, clamped: false } });

    const loadPromise = loadCoverage();
    // Yield the microtask queue so the second `fetchBffJson` call inside
    // `Promise.all` can fire.
    await Promise.resolve();
    await Promise.resolve();

    expect(fetchBffJson).toHaveBeenCalledTimes(2);

    resolveFirst({ kind: 'ok', data: { snapshot: null } });
    await loadPromise;
  });
});
