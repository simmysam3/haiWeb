import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ClassPicker } from '../class-picker';

const fetchMock = vi.fn();
beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe('ClassPicker', () => {
  it('searches the taxonomy through the BFF and picks a class (contract gap d-G3)', async () => {
    fetchMock.mockResolvedValue({
      ok: true, status: 200,
      text: async () => JSON.stringify({ classes: [{ class_id: 'cpt_full_grain_leather_hides', label: 'Full grain leather hides', class_path: ['Materials', 'Leather', 'Finished leather', 'Full grain leather hides'] }] }),
    });
    const onChange = vi.fn();
    render(<ClassPicker label="Upper leather" value={null} suggestion={null} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('Class search for Upper leather'), { target: { value: 'leather' } });
    fireEvent.click(screen.getByRole('button', { name: 'Find class for Upper leather' }));
    fireEvent.click(await screen.findByRole('button', { name: /Full grain leather hides/ }));
    expect(fetchMock.mock.calls[0]![0]).toBe('/api/account/sourcing-map/classes?q=leather');
    expect(onChange).toHaveBeenCalledWith({ class_id: 'cpt_full_grain_leather_hides', label: 'Full grain leather hides' });
  });

  it('returns keyboard focus to the class search after a pick, from the suggestion chip or from the results (WCAG 2.4.3)', async () => {
    /** A keyboard user's activation: focus the control, then press it. */
    const press = (el: HTMLElement) => {
      el.focus();
      fireEvent.click(el);
    };
    fetchMock.mockResolvedValue({
      ok: true, status: 200,
      text: async () => JSON.stringify({ classes: [{ class_id: 'cpt_full_grain_leather_hides', label: 'Full grain leather hides', class_path: ['Materials', 'Leather', 'Finished leather', 'Full grain leather hides'] }] }),
    });
    const onChange = vi.fn();
    const suggestion = { class_id: 'cpt_flat_laces', label: 'Flat laces', class_path: ['Components', 'Trims', 'Laces', 'Flat laces'], band: 'high' as const };
    const { rerender } = render(<ClassPicker label="Lace" value={null} suggestion={suggestion} onChange={onChange} />);
    press(screen.getByRole('button', { name: /^Use Flat laces/ }));
    expect(onChange).toHaveBeenLastCalledWith({ class_id: 'cpt_flat_laces', label: 'Flat laces' });
    // The parent takes the pick, so the chip goes.
    rerender(<ClassPicker label="Lace" value={{ class_id: 'cpt_flat_laces', label: 'Flat laces' }} suggestion={suggestion} onChange={onChange} />);
    expect(screen.queryByRole('button', { name: /^Use Flat laces/ })).toBeNull();
    expect(document.activeElement).toBe(screen.getByLabelText('Class search for Lace'));
    fireEvent.change(screen.getByLabelText('Class search for Lace'), { target: { value: 'leather' } });
    press(screen.getByRole('button', { name: 'Find class for Lace' }));
    press(await screen.findByRole('button', { name: /Full grain leather hides/ }));
    expect(screen.queryByRole('button', { name: /Full grain leather hides/ })).toBeNull();
    expect(document.activeElement).toBe(screen.getByLabelText('Class search for Lace'));
  });

  it('once the stale lock lands on a search already typed and run, Find, its results and the chip pick nothing, and none is disabled (stale-lock, LW-a)', async () => {
    fetchMock.mockResolvedValue({
      ok: true, status: 200,
      text: async () => JSON.stringify({ classes: [{ class_id: 'cpt_full_grain_leather_hides', label: 'Full grain leather hides', class_path: ['Materials', 'Leather', 'Finished leather', 'Full grain leather hides'] }] }),
    });
    const onChange = vi.fn();
    const suggestion = { class_id: 'cpt_flat_laces', label: 'Flat laces', class_path: ['Components', 'Trims', 'Laces', 'Flat laces'], band: 'high' as const };
    const { rerender } = render(<ClassPicker label="Lace" value={null} suggestion={suggestion} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('Class search for Lace'), { target: { value: 'leather' } });
    fireEvent.click(screen.getByRole('button', { name: 'Find class for Lace' }));
    const result = await screen.findByRole('button', { name: /Full grain leather hides/ });
    // A slow re-read fails now: the lock lands on a typed search, its results and the chip.
    rerender(<ClassPicker label="Lace" value={null} suggestion={suggestion} onChange={onChange} locked />);
    for (const control of [screen.getByRole('button', { name: 'Find class for Lace' }), result, screen.getByRole('button', { name: /^Use Flat laces/ })]) {
      fireEvent.click(control);
      expect(control).not.toBeDisabled();
      expect(control).toHaveAttribute('aria-disabled', 'true');
    }
    expect(onChange).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
