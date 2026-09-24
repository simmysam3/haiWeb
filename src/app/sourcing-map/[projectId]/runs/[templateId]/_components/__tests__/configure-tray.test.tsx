import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { vomeroProducts, vomeroRunTemplate, VOMERO_IDS } from '@/lib/sourcing-map/__fixtures__/vomero';
import { ConfigureTray } from '../configure-tray';

const { push, refresh, replace } = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, refresh, replace }),
  usePathname: () => '/sourcing-map/x',
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock('recharts', async () => {
  const actual = await vi.importActual<typeof import('recharts')>('recharts');
  return { ...actual, ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div> };
});

const fetchMock = vi.fn();
beforeEach(() => {
  fetchMock.mockReset();
  push.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.unstubAllGlobals());
function reply(status: number, body?: unknown) {
  return { ok: status >= 200 && status < 300, status, text: async () => (body === undefined ? '' : JSON.stringify(body)) };
}
const TWO = { ...vomeroRunTemplate, scope: { ...vomeroRunTemplate.scope, products: vomeroRunTemplate.scope.products.slice(0, 2) } };

describe('ConfigureTray', () => {
  it('adds (with a starting schedule), reorders and removes products, and Apply PATCHes the scope; a refusal is shown (contract gap d-G2)', async () => {
    fetchMock
      .mockResolvedValueOnce(reply(400, { error: { code: 'VALIDATION_ERROR', message: 'A size mix must total 100%.' } }))
      .mockResolvedValueOnce(reply(200, { template: TWO }));
    const onApplied = vi.fn();
    render(<ConfigureTray template={TWO} library={vomeroProducts} onApplied={onApplied} onClose={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Apply' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Add a product'), { target: { value: VOMERO_IDS.metcon } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    fireEvent.click(screen.getByRole('button', { name: 'Move Metcon Iron up' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove Pegasus Trail' }));
    expect(screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual(['Metcon Iron', 'Court Classic']);
    // defaultDemand on add (ruling 7): six monthly drops of 1,000 from the run's latest due date, and the curve mix.
    const metcon = screen.getByRole('heading', { level: 3, name: 'Metcon Iron' }).closest('section')!;
    expect(within(metcon).getByRole('figure', { name: '6 drops totalling 6,000 pairs' })).toBeInTheDocument();
    expect(within(metcon).getByText('Total 100%')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('A size mix must total 100%.');
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    await waitFor(() => expect(onApplied).toHaveBeenCalledWith(TWO));
    const [path, init] = fetchMock.mock.calls[1]!;
    expect(path).toBe(`/api/account/sourcing-map/runs/${VOMERO_IDS.template}`);
    expect(init.method).toBe('PATCH');
    const body = JSON.parse(init.body);
    expect(body.scope.products.map((p: { product_id: string }) => p.product_id)).toEqual([VOMERO_IDS.metcon, VOMERO_IDS.court]);
    expect(body.cadence).toEqual({ kind: 'manual_only' });
  });

  it('moves focus into the tray when it opens (R3, WCAG 2.1 AA)', () => {
    render(<ConfigureTray template={TWO} library={vomeroProducts} onApplied={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByRole('heading', { level: 2, name: 'Configure' })).toHaveFocus();
  });

  it('after Remove, focus lands on the next product’s Remove, else the previous one’s, else the product picker (R3)', () => {
    render(<ConfigureTray template={vomeroRunTemplate} library={vomeroProducts} onApplied={vi.fn()} onClose={vi.fn()} />);
    press('Remove Court Classic');
    expect(screen.getByRole('button', { name: 'Remove Metcon Iron' })).toHaveFocus();
    press('Remove Metcon Iron');
    expect(screen.getByRole('button', { name: 'Remove Pegasus Trail' })).toHaveFocus();
    press('Remove Pegasus Trail');
    expect(screen.getByLabelText('Add a product')).toHaveFocus();
  });
});

/** A real press: focus the control first, as a keyboard or pointer user does (fireEvent.click alone never moves focus). */
function press(name: string) {
  const button = screen.getByRole('button', { name });
  button.focus();
  fireEvent.click(button);
}
