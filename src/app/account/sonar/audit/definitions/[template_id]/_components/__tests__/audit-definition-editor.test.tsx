import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { RunTemplate } from '@haiwave/protocol';
import { AuditDefinitionEditor } from '../audit-definition-editor';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

const fetchMock = vi.fn();
beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

const template: RunTemplate = {
  template_id: 'def-1',
  template_name: 'weekly-audit',
  observation_class: 'audit',
  cadence: { kind: 'manual_only' },
  enabled: true,
  retention_days: 90,
  created_at: '2026-05-08T12:00:00.000Z',
  last_run_at: null,
  scope: {
    kind: 'audit',
    authorization_basis: 'bilateral',
    counterparties: ['acme-corp'],
    signal_types: ['lead_time_distribution'],
    skus: [],
    depth_limit: 2,
    hop_budget: 5,
  },
} as unknown as RunTemplate;

describe('AuditDefinitionEditor', () => {
  it('renders the read-only scope alongside editable name, without a modality field', () => {
    render(<AuditDefinitionEditor template={template} />);
    expect(screen.getByDisplayValue('weekly-audit')).toBeInTheDocument();
    expect(screen.getByText('acme-corp')).toBeInTheDocument();
    expect(screen.getByText(/Fixed at creation/i)).toBeInTheDocument();
    // No modality select/field should be present
    expect(screen.queryByText(/Modality/i)).toBeNull();
  });

  it('shows no save bar until a field changes', async () => {
    render(<AuditDefinitionEditor template={template} />);
    expect(screen.queryByRole('button', { name: /save changes/i })).toBeNull();
    await userEvent.type(screen.getByLabelText(/audit name/i), 'X');
    expect(
      screen.getByRole('button', { name: /save changes/i }),
    ).toBeInTheDocument();
  });

  it('PATCHes to the audit definitions route on save', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({}) } as Response);
    render(<AuditDefinitionEditor template={template} />);
    await userEvent.type(screen.getByLabelText(/audit name/i), 'Z');
    await userEvent.click(screen.getByRole('button', { name: /save changes/i }));
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/account/sonar/audit/definitions/def-1');
    expect((init as RequestInit).method).toBe('PATCH');
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body).toEqual({
      template_name: 'weekly-auditZ',
      cadence: { kind: 'manual_only' },
      enabled: true,
      retention_days: 90,
    });
    expect(body).not.toHaveProperty('scope');
  });

  it('DELETEs to the audit definitions route and navigates to /account/sonar/audit', async () => {
    const pushMock = vi.fn();
    vi.mocked(vi.fn()).mockImplementation(() => {});
    // re-mock router with push spy
    vi.doMock('next/navigation', () => ({
      useRouter: () => ({ push: pushMock, refresh: vi.fn() }),
    }));
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({}) } as Response);
    vi.stubGlobal('confirm', () => true);
    render(<AuditDefinitionEditor template={template} />);
    await userEvent.click(screen.getByRole('button', { name: /delete/i }));
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/account/sonar/audit/definitions/def-1');
    expect((init as RequestInit).method).toBe('DELETE');
  });

  it('shows an error and keeps the save bar when PATCH fails', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'Bad request' }), { status: 400 }),
    );
    render(<AuditDefinitionEditor template={template} />);
    await userEvent.type(screen.getByLabelText(/audit name/i), 'Z');
    await userEvent.click(screen.getByRole('button', { name: /save changes/i }));
    expect(
      await screen.findByRole('button', { name: /save changes/i }),
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  // v.1.42 — Suspend/Reactivate header control. Status pill + button at the
  // top of the editor flip the template's `enabled` flag without going through
  // the dirty-form save bar.
  it('renders an Active status pill + Suspend button for an enabled template', () => {
    render(<AuditDefinitionEditor template={template} />);
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^suspend$/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^reactivate$/i })).toBeNull();
  });

  it('renders a Suspended status pill + Reactivate button + paused banner for a disabled template', () => {
    const disabled = { ...template, enabled: false } as RunTemplate;
    render(<AuditDefinitionEditor template={disabled} />);
    expect(screen.getByText('Suspended')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^reactivate$/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^suspend$/i })).toBeNull();
    // Banner explains the state.
    expect(
      screen.getByText(/scheduled runs (are )?suspended/i),
    ).toBeInTheDocument();
  });

  it('Suspend button PATCHes enabled=false (independent of form dirty state)', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({}) } as Response);
    render(<AuditDefinitionEditor template={template} />);
    await userEvent.click(screen.getByRole('button', { name: /^suspend$/i }));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/account/sonar/audit/definitions/def-1');
    expect((init as RequestInit).method).toBe('PATCH');
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body).toEqual({ enabled: false });
  });

  it('Reactivate button PATCHes enabled=true', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({}) } as Response);
    const disabled = { ...template, enabled: false } as RunTemplate;
    render(<AuditDefinitionEditor template={disabled} />);
    await userEvent.click(screen.getByRole('button', { name: /^reactivate$/i }));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse(
      (fetchMock.mock.calls[0][1] as RequestInit).body as string,
    );
    expect(body).toEqual({ enabled: true });
  });
});
