import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TestDrawer } from '../_components/test-drawer';

describe('TestDrawer', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        results: [
          { rule_type: 'sku_breadth', would_trip: true, observed: 20, threshold: 15, source: 'class', actions: [{ type: 'pause', duration_minutes: 120 }] },
          { rule_type: 'sku_repeat', would_trip: false, observed: 3, threshold: 10, source: 'default', actions: [{ type: 'alert', email: null }] },
        ],
      }),
    } as Response);
  });
  afterEach(() => fetchSpy.mockRestore());

  it('POSTs the hypothetical shape and renders would-trip results', async () => {
    render(<TestDrawer open onClose={() => {}} />);
    fireEvent.change(screen.getByLabelText(/trust class/i), { target: { value: 'unknown' } });
    fireEvent.change(screen.getByLabelText(/distinct skus/i), { target: { value: '20' } });
    fireEvent.click(screen.getByRole('button', { name: /run test/i }));
    await waitFor(() => expect(fetchSpy).toHaveBeenCalled());
    const [url, init] = fetchSpy.mock.calls[0];
    expect(String(url)).toContain('/api/account/query-guard/test');
    expect(JSON.parse((init as RequestInit).body as string)).toMatchObject({ trust_class: 'unknown', distinct_skus: 20 });
    expect(await screen.findByText(/would trip/i)).toBeInTheDocument();
    expect(screen.getByText(/20 > 15/)).toBeInTheDocument();
  });
});
