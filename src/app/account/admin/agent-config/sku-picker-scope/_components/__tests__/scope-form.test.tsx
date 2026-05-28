import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ScopeForm } from '../scope-form';

describe('ScopeForm', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders agent input + scope radios + save button', () => {
    render(<ScopeForm />);
    expect(screen.getByPlaceholderText(/agent uuid/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/published catalog only/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/full catalog/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument();
  });

  it('PUTs to BFF when save is clicked', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ agent_id: 'a1', sku_picker_scope: 'published_only' }),
    });
    fetchMock.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) });

    render(<ScopeForm />);
    fireEvent.change(screen.getByPlaceholderText(/agent uuid/i), {
      target: { value: '00000000-0000-0000-0000-000000000001' },
    });
    // wait for initial GET to settle
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByLabelText(/full catalog/i));
    fireEvent.click(screen.getByRole('button', { name: /save/i }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(fetchMock.mock.calls[1][0]).toBe('/api/account/admin/agent-config/sku-picker-scope');
    expect(fetchMock.mock.calls[1][1].method).toBe('PUT');
    const body = JSON.parse(fetchMock.mock.calls[1][1].body as string);
    expect(body).toEqual({
      agent_id: '00000000-0000-0000-0000-000000000001',
      sku_picker_scope: 'full_catalog',
    });
  });
});
