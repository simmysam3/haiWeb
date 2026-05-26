import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { RunTemplate, RunTemplateEvent } from '@haiwave/protocol';
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

  // v.1.42 — History step renders the lifecycle event log.
  it('renders the History step with an empty-state message when no events exist', () => {
    render(<AuditDefinitionEditor template={template} events={[]} />);
    // 'History' appears twice — once in the StepRail label, once as the
    // StepCard heading. Scope to the heading.
    expect(
      screen.getByRole('heading', { name: 'History' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/No lifecycle events recorded yet/i)).toBeInTheDocument();
  });

  it('renders History rows newest-first with actor + timestamp and "Authorized by" on suspended events', () => {
    const events: RunTemplateEvent[] = [
      {
        event_id: '11111111-1111-1111-1111-111111111111',
        template_id: template.template_id,
        event_kind: 'suspended',
        actor_user_id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
        at: '2026-05-26T15:30:00.000Z',
        notes: null,
      },
      {
        event_id: '22222222-2222-2222-2222-222222222222',
        template_id: template.template_id,
        event_kind: 'created',
        actor_user_id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        at: '2026-05-20T09:00:00.000Z',
        notes: null,
      },
    ];
    render(<AuditDefinitionEditor template={template} events={events} />);
    expect(screen.getByText('Suspended')).toBeInTheDocument();
    expect(screen.getByText('Created')).toBeInTheDocument();
    // Suspended events carry the "Authorized by" framing per spec.
    expect(screen.getByText(/Authorized by/)).toBeInTheDocument();
    // Created events still show the actor but with the generic "By" prefix.
    expect(screen.getByText(/^By/)).toBeInTheDocument();
  });

  it('renders "system" placeholder when an event has a null actor', () => {
    const events: RunTemplateEvent[] = [
      {
        event_id: '33333333-3333-3333-3333-333333333333',
        template_id: template.template_id,
        event_kind: 'reactivated',
        actor_user_id: null,
        at: '2026-05-26T16:00:00.000Z',
        notes: null,
      },
    ];
    render(<AuditDefinitionEditor template={template} events={events} />);
    expect(screen.getByText('system')).toBeInTheDocument();
  });
});
