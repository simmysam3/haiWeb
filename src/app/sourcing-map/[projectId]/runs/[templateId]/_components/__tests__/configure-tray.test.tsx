import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SM_LIMITS } from '@/lib/sourcing-map/contract';
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

  it('after Up or Down, focus stays on that button in the moved section, or its sibling once it is disabled (R3)', () => {
    render(<ConfigureTray template={vomeroRunTemplate} library={vomeroProducts} onApplied={vi.fn()} onClose={vi.fn()} />);
    press('Move Pegasus Trail down'); // [Court, Pegasus, Metcon]
    expect(screen.getByRole('button', { name: 'Move Pegasus Trail down' })).toHaveFocus();
    press('Move Pegasus Trail down'); // [Court, Metcon, Pegasus]: Pegasus's Down is disabled
    expect(screen.getByRole('button', { name: 'Move Pegasus Trail up' })).toHaveFocus();
    press('Move Metcon Iron up'); // [Metcon, Court, Pegasus]: Metcon's Up is disabled
    expect(screen.getByRole('button', { name: 'Move Metcon Iron down' })).toHaveFocus();
    expect(screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual(['Metcon Iron', 'Court Classic', 'Pegasus Trail']);
  });

  it('after Add, focus lands on the new product’s heading, since Add is disabled again (R3)', () => {
    render(<ConfigureTray template={TWO} library={vomeroProducts} onApplied={vi.fn()} onClose={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Add a product'), { target: { value: VOMERO_IDS.metcon } });
    press('Add');
    expect(screen.getByRole('button', { name: 'Add' })).toBeDisabled();
    expect(screen.getByRole('heading', { level: 3, name: 'Metcon Iron' })).toHaveFocus();
  });

  it('editing a drop’s due date keeps the same input, and focus, so typing a date is not cut off (R3)', () => {
    render(<ConfigureTray template={TWO} library={vomeroProducts} onApplied={vi.fn()} onClose={vi.fn()} />);
    const due = screen.getByLabelText('Due date of drop 1 for Pegasus Trail');
    due.focus();
    fireEvent.change(due, { target: { value: '2027-01-10' } });
    expect(screen.getByLabelText('Due date of drop 1 for Pegasus Trail')).toBe(due);
    expect(due).toHaveFocus();
    expect(due).toHaveValue('2027-01-10');
  });

  it('an edit to the draft clears a refused Apply’s message, which named the draft before the edit', async () => {
    fetchMock.mockResolvedValueOnce(reply(400, { error: { code: 'VALIDATION_ERROR', message: 'A size mix must total 100%.' } }));
    render(<ConfigureTray template={TWO} library={vomeroProducts} onApplied={vi.fn()} onClose={vi.fn()} />);
    press('Remove Court Classic');
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    const tray = screen.getByRole('complementary', { name: 'Configure run' });
    expect(await within(tray).findByRole('alert')).toHaveTextContent('A size mix must total 100%.');
    fireEvent.change(screen.getByLabelText('Quantity of drop 2 for Pegasus Trail'), { target: { value: '6500' } });
    expect(screen.queryByText('A size mix must total 100%.')).toBeNull();
  });

  it('saves run settings: depth cap, seat weekly capacity and cadence', async () => {
    fetchMock.mockResolvedValue(reply(200, { template: TWO }));
    render(<ConfigureTray template={TWO} library={vomeroProducts} onApplied={vi.fn()} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Run settings' }));
    fireEvent.change(screen.getByLabelText('Depth cap'), { target: { value: '3' } });
    fireEvent.change(screen.getByLabelText('Seat weekly capacity (units per week, optional)'), { target: { value: '' } });
    fireEvent.change(screen.getByLabelText('Cadence'), { target: { value: 'weekly' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const body = JSON.parse(fetchMock.mock.calls[0]![1].body);
    expect(body.scope.depth_cap).toBe(3);
    expect(body.scope.seat_weekly_capacity).toBeNull();
    expect(body.cadence).toEqual({ kind: 'weekly', day_of_week: 'mon', time_of_day: '06:00' });
  });

  it('a run-settings edit also clears a refused Apply’s message', async () => {
    const REFUSAL = `depth_cap must be between ${SM_LIMITS.DEPTH_CAP_MIN} and ${SM_LIMITS.DEPTH_CAP_MAX}.`;
    fetchMock.mockResolvedValue(reply(400, { error: { code: 'VALIDATION_ERROR', message: REFUSAL } }));
    render(<ConfigureTray template={TWO} library={vomeroProducts} onApplied={vi.fn()} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Run settings' }));
    fireEvent.change(screen.getByLabelText('Depth cap'), { target: { value: '3' } });
    const refuse = async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
      expect(await screen.findByRole('alert')).toHaveTextContent(REFUSAL);
    };
    await refuse();
    fireEvent.change(screen.getByLabelText('Depth cap'), { target: { value: '4' } });
    expect(screen.queryByText(REFUSAL)).toBeNull();
    await refuse();
    fireEvent.change(screen.getByLabelText('Seat weekly capacity (units per week, optional)'), { target: { value: '9000' } });
    expect(screen.queryByText(REFUSAL)).toBeNull();
    await refuse();
    fireEvent.change(screen.getByLabelText('Cadence'), { target: { value: 'monthly' } });
    expect(screen.queryByText(REFUSAL)).toBeNull();
  });

  it('duplicates the run (demand only) and opens the copy', async () => {
    fetchMock.mockResolvedValue(reply(201, { template: { ...TWO, template_id: VOMERO_IDS.executionOld } }));
    render(<ConfigureTray template={TWO} library={vomeroProducts} onApplied={vi.fn()} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Duplicate run' }));
    await waitFor(() => expect(push).toHaveBeenCalledWith(`/sourcing-map/${VOMERO_IDS.project}/runs/${VOMERO_IDS.executionOld}`));
    expect(fetchMock.mock.calls[0]![0]).toBe(`/api/account/sourcing-map/runs/${VOMERO_IDS.template}/duplicate`);
    expect(fetchMock.mock.calls[0]![1].method).toBe('POST');
  });

  it('Close waits while Apply or Duplicate is in flight, so a failure’s message is never lost to a close (R2, a-G4)', async () => {
    let settle: (r: unknown) => void = () => {};
    fetchMock.mockImplementation(() => new Promise((resolve) => { settle = resolve; }));
    const onClose = vi.fn();
    render(<ConfigureTray template={TWO} library={vomeroProducts} onApplied={vi.fn()} onClose={onClose} />);
    press('Remove Court Classic');
    const close = screen.getByRole('button', { name: 'Close' });
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    expect(close).toBeDisabled();
    fireEvent.click(close);
    expect(onClose).not.toHaveBeenCalled();
    settle(reply(400, { error: { code: 'VALIDATION_ERROR', message: 'A size mix must total 100%.' } }));
    expect(await screen.findByRole('alert')).toHaveTextContent('A size mix must total 100%.');
    expect(close).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Duplicate run' }));
    expect(close).toBeDisabled();
    settle(reply(404, { error: { code: 'not_found', message: 'That run no longer exists.' } }));
    expect(await screen.findByRole('alert')).toHaveTextContent('That run no longer exists.');
    expect(close).toBeEnabled();
    expect(push).not.toHaveBeenCalled();
  });

  it('uploads a demand schedule through the wizard and replaces the product’s drops (AC 9)', async () => {
    const NL = String.fromCharCode(10);
    render(<ConfigureTray template={TWO} library={vomeroProducts} onApplied={vi.fn()} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Upload schedule' }));
    const file = new File([['Style,Due,Size,Pairs', 'Pegasus Trail,46402,9,300', 'Pegasus Trail,46433,9,400'].join(NL)], 'demand.csv', { type: 'text/csv' });
    await userEvent.upload(screen.getByLabelText('Spreadsheet file'), file);
    fireEvent.click(await screen.findByRole('button', { name: 'Continue' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Apply schedule' }));
    const pegasus = screen.getByRole('heading', { level: 3, name: 'Pegasus Trail' }).closest('section')!;
    expect(within(pegasus).getByLabelText('Due date of drop 1 for Pegasus Trail')).toHaveValue('2027-01-15');
    expect(within(pegasus).getByLabelText('Quantity of drop 2 for Pegasus Trail')).toHaveValue(400);
    expect(screen.getByRole('button', { name: 'Apply' })).toBeEnabled();
  });

  it('after an upload replaces a schedule, that product’s generator shows the uploaded drops; the others keep their inputs (R1)', async () => {
    const NL = String.fromCharCode(10);
    render(<ConfigureTray template={TWO} library={vomeroProducts} onApplied={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByLabelText('Total for Pegasus Trail')).toHaveValue(36000);
    expect(screen.getByLabelText('Drops for Pegasus Trail')).toHaveValue(6);
    fireEvent.change(screen.getByLabelText('Total for Court Classic'), { target: { value: '12000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Upload schedule' }));
    const file = new File([['Style,Due,Size,Pairs', 'Pegasus Trail,46402,9,300', 'Pegasus Trail,46433,9,400'].join(NL)], 'demand.csv', { type: 'text/csv' });
    await userEvent.upload(screen.getByLabelText('Spreadsheet file'), file);
    fireEvent.click(await screen.findByRole('button', { name: 'Continue' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Apply schedule' }));
    expect(screen.getByLabelText('Total for Pegasus Trail')).toHaveValue(700);
    expect(screen.getByLabelText('Drops for Pegasus Trail')).toHaveValue(2);
    expect(screen.getByLabelText('Total for Court Classic')).toHaveValue(12000);
  });

  it('a per-drop override edited by pairs keeps the typed count too (Task 34 fix I-2: it is the same SizeMixEditor)', () => {
    render(<ConfigureTray template={TWO} library={vomeroProducts} onApplied={vi.fn()} onClose={vi.fn()} />);
    fireEvent.click(screen.getByLabelText('Override the mix for drop 3 of Pegasus Trail'));
    const override = screen.getByRole('group', { name: 'Size mix for Pegasus Trail drop 3' });
    fireEvent.click(within(override).getByRole('radio', { name: 'Edit by pairs' }));
    const ten = within(override).getByLabelText('10 pairs');
    for (const typed of ['2', '20', '200', '2000']) fireEvent.change(ten, { target: { value: typed } }); // typed key by key
    expect(ten).toHaveValue(2000);
  });
  it('keeps Apply focusable while its PATCH is in flight: aria-busy, and a second press sends nothing (LW-a)', async () => {
    let settle: (r: unknown) => void = () => {};
    fetchMock.mockImplementation(() => new Promise((resolve) => { settle = resolve; }));
    const onApplied = vi.fn();
    render(<ConfigureTray template={TWO} library={vomeroProducts} onApplied={onApplied} onClose={vi.fn()} />);
    press('Remove Court Classic');
    press('Apply');
    const apply = screen.getByRole('button', { name: 'Apply' });
    expect(apply).toHaveAttribute('aria-busy', 'true');
    expect(apply).toHaveAttribute('aria-disabled', 'true');
    expect(apply).not.toBeDisabled();
    expect(apply).toHaveFocus();
    fireEvent.click(apply);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    // The other action is not the one pressed: it stays disabled, without aria-busy.
    expect(screen.getByRole('button', { name: 'Duplicate run' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Duplicate run' })).not.toHaveAttribute('aria-busy');
    settle(reply(200, { template: TWO }));
    await waitFor(() => expect(onApplied).toHaveBeenCalledTimes(1));
  });
  it('keeps Duplicate run focusable while its request is in flight: aria-busy, and a second press sends nothing (LW-a)', async () => {
    let settle: (r: unknown) => void = () => {};
    fetchMock.mockImplementation(() => new Promise((resolve) => { settle = resolve; }));
    render(<ConfigureTray template={TWO} library={vomeroProducts} onApplied={vi.fn()} onClose={vi.fn()} />);
    press('Duplicate run');
    const duplicate = screen.getByRole('button', { name: 'Duplicate run' });
    expect(duplicate).toHaveAttribute('aria-busy', 'true');
    expect(duplicate).toHaveAttribute('aria-disabled', 'true');
    expect(duplicate).not.toBeDisabled();
    expect(duplicate).toHaveFocus();
    fireEvent.click(duplicate);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    settle(reply(201, { template: { ...TWO, template_id: VOMERO_IDS.executionOld } }));
    await waitFor(() => expect(push).toHaveBeenCalledTimes(1));
  });
});

/** A real press: focus the control first, as a keyboard or pointer user does (fireEvent.click alone never moves focus). */
function press(name: string) {
  const button = screen.getByRole('button', { name });
  button.focus();
  fireEvent.click(button);
}
