import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MesForm } from '../mes-form';

describe('MesForm', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders agent input + enable checkbox + save button', () => {
    render(<MesForm />);
    expect(screen.getByPlaceholderText(/agent uuid/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/enable mes live capacity check/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument();
  });

  it('PUTs with mes_config: null when disabled', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ mes_enabled: false, mes_config: null }),
    });
    fetchMock.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) });

    render(<MesForm />);
    fireEvent.change(screen.getByPlaceholderText(/agent uuid/i), {
      target: { value: '00000000-0000-0000-0000-000000000002' },
    });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole('button', { name: /save/i }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(fetchMock.mock.calls[1][0]).toBe('/api/account/admin/agent-config/mes-integration');
    expect(fetchMock.mock.calls[1][1].method).toBe('PUT');
    const body = JSON.parse(fetchMock.mock.calls[1][1].body as string);
    expect(body).toEqual({
      agent_id: '00000000-0000-0000-0000-000000000002',
      mes_enabled: false,
      mes_config: null,
    });
  });

  it('PUTs with full mes_config when enabled', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          mes_enabled: true,
          mes_config: {
            endpoint_url: 'https://mes.example.com',
            auth_scheme: 'bearer',
            credential_ref: 'MES_TOKEN',
            work_center_mapping: {},
          },
        }),
    });
    fetchMock.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) });

    render(<MesForm />);
    fireEvent.change(screen.getByPlaceholderText(/agent uuid/i), {
      target: { value: '00000000-0000-0000-0000-000000000003' },
    });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    // MES enabled was loaded from GET — save should include config
    fireEvent.click(screen.getByRole('button', { name: /save/i }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const body = JSON.parse(fetchMock.mock.calls[1][1].body as string);
    expect(body.mes_enabled).toBe(true);
    expect(body.mes_config).not.toBeNull();
    expect(body.mes_config.endpoint_url).toBe('https://mes.example.com');
  });
});
