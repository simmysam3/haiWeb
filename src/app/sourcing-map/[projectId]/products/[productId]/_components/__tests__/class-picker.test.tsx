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
});
