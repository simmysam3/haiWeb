import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ReviewQueuePanel } from '../review-queue-panel';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

/** URL-routed fetch double at the BFF boundary. */
function routeFetch(items: () => Response) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url = String(input);
    if (url.startsWith('/api/account/data-cleansing/taxonomy')) return jsonResponse({ nodes: [], total_count: 0 });
    if (url.startsWith('/api/account/data-cleansing')) return items();
    throw new Error(`unexpected fetch ${url}`);
  });
}

describe('ReviewQueuePanel — a failed read is never an all-clear (SEC-web-account-2-06)', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('a failed items read shows a could-not-load notice with Retry and never the all-clear message', async () => {
    routeFetch(() => jsonResponse({ error: 'Unauthorized' }, 401));
    render(<ReviewQueuePanel />);

    expect(await screen.findByText(/couldn.t load/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    expect(screen.queryByText(/all products have been classified/i)).not.toBeInTheDocument();
  });

  it('Retry re-reads the queue after a failed first load', async () => {
    let attempt = 0;
    routeFetch(() => {
      attempt += 1;
      return attempt === 1
        ? jsonResponse({ error: 'down' }, 500)
        : jsonResponse({ results: [{ product_id: 'prod-1', product_name: 'Widget', reason: 'ambiguous', confidence: 0.2, candidates: [] }], total: 1 });
    });
    render(<ReviewQueuePanel />);
    await screen.findByText(/couldn.t load/i);

    fireEvent.click(screen.getByRole('button', { name: /retry/i }));

    expect(await screen.findByText(/Unclassifiable Products \(1\)/)).toBeInTheDocument();
    expect(screen.queryByText(/couldn.t load/i)).not.toBeInTheDocument();
  });
});
