import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useManifestSearch } from '../use-manifest-search';

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  global.fetch = fetchMock as unknown as typeof fetch;
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

function jsonResponse(body: unknown): Response {
  return { ok: true, status: 200, json: async () => body } as Response;
}

describe('useManifestSearch', () => {
  it('does not fetch for empty or single-char queries', () => {
    const { result } = renderHook(() => useManifestSearch());
    act(() => result.current.setQuery(''));
    act(() => result.current.setQuery('a'));
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('debounces 250ms and fetches once per pause', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ matches: [] }));
    const { result } = renderHook(() => useManifestSearch());
    act(() => result.current.setQuery('wi'));
    act(() => {
      vi.advanceTimersByTime(100);
    });
    act(() => result.current.setQuery('wid'));
    act(() => {
      vi.advanceTimersByTime(100);
    });
    act(() => result.current.setQuery('widg'));
    act(() => {
      vi.advanceTimersByTime(300);
    });
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain('q=widg');
  });

  it('surfaces error when /search fetch fails', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500, json: async () => ({}) } as Response);
    const { result } = renderHook(() => useManifestSearch());
    act(() => result.current.setQuery('widget'));
    act(() => {
      vi.advanceTimersByTime(300);
    });
    await vi.waitFor(() => expect(result.current.state.error).not.toBeNull());
  });
});
