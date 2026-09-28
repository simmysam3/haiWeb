import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useApi } from '../use-api';

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
}

// Flushed to exhaustion so a settle is not merely still pending.
async function drain() {
  for (let i = 0; i < 5; i += 1) await new Promise((r) => setTimeout(r, 0));
}

afterEach(() => vi.restoreAllMocks());

describe('useApi — refetch()', () => {
  it('never renders the answer of a load that refetch() superseded, even one that settles before the refetch renders', async () => {
    const answers: Array<(res: Response) => void> = [];
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      () => new Promise<Response>((resolve) => { answers.push(resolve); }),
    );
    const rendered: string[] = [];
    const { result } = renderHook(() => {
      const api = useApi<string>({ url: '/api/x', fallback: 'fallback' });
      rendered.push(api.data);
      return api;
    });
    expect(answers).toHaveLength(1); // load A is in flight

    // refetch() and load A's answer reach one batch: A settles before the refetch has rendered, so the effect
    // cleanup has not cancelled it yet.
    await act(async () => {
      result.current.refetch();
      answers[0](jsonResponse('A'));
      await drain();
    });
    expect(answers).toHaveLength(2); // load B is in flight

    await act(async () => {
      answers[1](jsonResponse('B'));
      await drain();
    });

    expect(result.current.data).toBe('B');
    expect(result.current.loading).toBe(false);
    expect(rendered).not.toContain('A');
  });
});

describe('useApi — mutate', () => {
  it('keeps one mutate across rerenders, including the one its own update causes', () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => new Promise<Response>(() => {}));
    const { result, rerender } = renderHook(() => useApi<string[]>({ url: '/api/x', fallback: [] }));
    const first = result.current.mutate;

    rerender();
    expect(result.current.mutate).toBe(first);

    act(() => result.current.mutate((prev) => [...prev, 'x']));
    expect(result.current.data).toEqual(['x']);
    expect(result.current.mutate).toBe(first);
  });
});
