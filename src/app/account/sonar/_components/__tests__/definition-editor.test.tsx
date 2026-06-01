import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { RunTemplate, RunTemplateEvent } from '@haiwave/protocol';
import { DefinitionEditor } from '../definition-editor';
import { ScopeSummary } from '../../templates/_components/scope-summary';

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

function renderAuditEditor(opts: { template?: RunTemplate; events?: RunTemplateEvent[] } = {}) {
  const tpl = opts.template ?? template;
  return render(
    <DefinitionEditor
      template={tpl}
      events={opts.events}
      observationClass="audit"
      scopePicker={<ScopeSummary scope={tpl.scope} />}
      endpointBase="/api/account/sonar/audit/definitions"
      listRoute="/account/sonar/audit"
    />,
  );
}

describe('DefinitionEditor (audit)', () => {
  it('renders the read-only scope alongside editable name, without a modality field', () => {
    renderAuditEditor();
    expect(screen.getByDisplayValue('weekly-audit')).toBeInTheDocument();
    expect(screen.getByText('acme-corp')).toBeInTheDocument();
    expect(screen.getByText(/Fixed at creation/i)).toBeInTheDocument();
    expect(screen.queryByText(/Modality/i)).toBeNull();
  });

  it('shows the modality-specific scope step title', () => {
    renderAuditEditor();
    expect(
      screen.getByRole('heading', { name: 'Audit Scope' }),
    ).toBeInTheDocument();
  });

  it('shows no save bar until a field changes', async () => {
    renderAuditEditor();
    expect(screen.queryByRole('button', { name: /save changes/i })).toBeNull();
    await userEvent.type(screen.getByLabelText(/audit name/i), 'X');
    expect(
      screen.getByRole('button', { name: /save changes/i }),
    ).toBeInTheDocument();
  });

  it('PATCHes to the endpointBase route on save', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({}) } as Response);
    renderAuditEditor();
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

  it('DELETEs to the endpointBase route on delete', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({}) } as Response);
    vi.stubGlobal('confirm', () => true);
    renderAuditEditor();
    await userEvent.click(screen.getByRole('button', { name: /delete/i }));
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/account/sonar/audit/definitions/def-1');
    expect((init as RequestInit).method).toBe('DELETE');
  });

  it('shows an error and keeps the save bar when PATCH fails', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'Bad request' }), { status: 400 }),
    );
    renderAuditEditor();
    await userEvent.type(screen.getByLabelText(/audit name/i), 'Z');
    await userEvent.click(screen.getByRole('button', { name: /save changes/i }));
    expect(
      await screen.findByRole('button', { name: /save changes/i }),
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  // v.1.43 follow-up — Activation moved into the Schedule step as a radio
  // group (Active / Suspended). PATCH still fires immediately on change.
  it('renders the Active radio checked for an enabled template', () => {
    renderAuditEditor();
    const active = screen.getByRole('radio', { name: 'Active' });
    const suspended = screen.getByRole('radio', { name: 'Suspended' });
    expect(active).toBeChecked();
    expect(suspended).not.toBeChecked();
  });

  it('renders the Suspended radio checked for a disabled template', () => {
    const disabled = { ...template, enabled: false } as RunTemplate;
    renderAuditEditor({ template: disabled });
    const active = screen.getByRole('radio', { name: 'Active' });
    const suspended = screen.getByRole('radio', { name: 'Suspended' });
    expect(active).not.toBeChecked();
    expect(suspended).toBeChecked();
  });

  it('selecting Suspended PATCHes enabled=false (independent of form dirty state)', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({}) } as Response);
    renderAuditEditor();
    await userEvent.click(screen.getByRole('radio', { name: 'Suspended' }));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/account/sonar/audit/definitions/def-1');
    expect((init as RequestInit).method).toBe('PATCH');
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body).toEqual({ enabled: false });
  });

  it('selecting Active PATCHes enabled=true', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({}) } as Response);
    const disabled = { ...template, enabled: false } as RunTemplate;
    renderAuditEditor({ template: disabled });
    await userEvent.click(screen.getByRole('radio', { name: 'Active' }));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse(
      (fetchMock.mock.calls[0][1] as RequestInit).body as string,
    );
    expect(body).toEqual({ enabled: true });
  });

  it('renders the History step with an empty-state message when no events exist', () => {
    renderAuditEditor({ events: [] });
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
    renderAuditEditor({ events });
    // "Suspended" appears twice — the history badge for this event AND the
    // activation radio label inside the Schedule step. Match at least one.
    expect(screen.getAllByText('Suspended').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Created')).toBeInTheDocument();
    expect(screen.getByText(/Authorized by/)).toBeInTheDocument();
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
    renderAuditEditor({ events });
    expect(screen.getByText('system')).toBeInTheDocument();
  });
});

describe('DefinitionEditor (observationClass parameterization)', () => {
  it('renders "Watcher Scope" step title and "Watcher is active" aria-label for observationClass="watcher"', () => {
    render(
      <DefinitionEditor
        template={template}
        observationClass="watcher"
        scopePicker={<div>watcher-scope-content</div>}
        endpointBase="/api/account/sonar/watchers/definitions"
        listRoute="/account/sonar/watchers"
      />,
    );
    expect(
      screen.getByRole('heading', { name: 'Watcher Scope' }),
    ).toBeInTheDocument();
    // Activation lives in the Schedule step as a radio group now (v.1.43
    // follow-up). The Active option is checked by default for enabled tpls.
    expect(screen.getByRole('radio', { name: 'Active' })).toBeChecked();
    expect(screen.getByText('watcher-scope-content')).toBeInTheDocument();
  });
});

describe('DefinitionEditor (scopeLocked=false — watcher path)', () => {
  function renderWatcherEditor(opts: {
    template?: RunTemplate;
    scopeValue?: RunTemplate['scope'];
    onScopeChange?: (next: RunTemplate['scope']) => void;
  } = {}) {
    const tpl = opts.template ?? template;
    const scope = opts.scopeValue ?? tpl.scope;
    const onScopeChange = opts.onScopeChange ?? vi.fn();
    return render(
      <DefinitionEditor
        template={tpl}
        observationClass="watcher"
        scopePicker={<div data-testid="watcher-scope-picker">watcher-scope-content</div>}
        scopeLocked={false}
        scopeValue={scope}
        onScopeChange={onScopeChange}
        endpointBase="/api/account/sonar/watcher/definitions"
        listRoute="/account/sonar/watchers"
      />,
    );
  }

  it('renders the scope StepCard without the locked treatment when scopeLocked=false', () => {
    renderWatcherEditor();
    // The unlocked path renders the scopePicker slot directly without the
    // "Fixed at creation" advisory that locked audit scope shows.
    expect(screen.queryByText(/Fixed at creation/i)).toBeNull();
    expect(screen.getByTestId('watcher-scope-picker')).toBeInTheDocument();
  });

  it('triggers the save bar when scope changes (dirty form includes scope)', async () => {
    const changedScope = { ...template.scope, depth_limit: 3 } as RunTemplate['scope'];
    renderWatcherEditor({ scopeValue: changedScope });
    // The form is "dirty" because scopeValue !== template.scope — save bar visible.
    expect(
      screen.getByRole('button', { name: /save changes/i }),
    ).toBeInTheDocument();
  });

  it('PATCH body includes scope when scopeLocked=false and scope changed', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({}) } as Response);
    const changedScope = { ...template.scope, depth_limit: 3 } as RunTemplate['scope'];
    renderWatcherEditor({ scopeValue: changedScope });
    await userEvent.click(screen.getByRole('button', { name: /save changes/i }));
    const body = JSON.parse(
      (fetchMock.mock.calls[0][1] as RequestInit).body as string,
    );
    // v.1.43 drift step — watcher PATCHes now merge drift_thresholds into
    // scope. Assert the scope-picker fields land verbatim and the drift
    // thresholds object is present (default values from protocol).
    expect(body.scope).toMatchObject(changedScope);
    expect(body.scope.drift_thresholds).toBeDefined();
  });

  it('PATCH body does NOT include scope when scopeLocked=true (audit default)', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({}) } as Response);
    renderAuditEditor();
    await userEvent.type(screen.getByLabelText(/audit name/i), 'Z');
    await userEvent.click(screen.getByRole('button', { name: /save changes/i }));
    const body = JSON.parse(
      (fetchMock.mock.calls[0][1] as RequestInit).body as string,
    );
    expect(body).not.toHaveProperty('scope');
  });
});

// v.1.43 drift step — only watcher templates get a Drift step. The fields
// are locked when cadence is manual_only (drift is a scheduled-observation
// concept). The audit path must remain entirely unchanged.
describe('DefinitionEditor (drift step — watcher only)', () => {
  const watcherTemplate: RunTemplate = {
    template_id: 'def-watcher-1',
    template_name: 'lt-watcher',
    observation_class: 'watcher',
    cadence: { kind: 'daily', hour_local: 9, minute_local: 0, timezone: 'UTC' },
    enabled: true,
    retention_days: 90,
    created_at: '2026-05-08T12:00:00.000Z',
    last_run_at: null,
    scope: {
      kind: 'watcher',
      authorization_basis: 'bilateral',
      counterparties: ['acme-corp'],
      signal_types: ['lead_time_distribution'],
      skus: [],
      depth_limit: 1,
    },
  } as unknown as RunTemplate;

  function renderWatcherEditor(opts: { template?: RunTemplate } = {}) {
    const tpl = opts.template ?? watcherTemplate;
    return render(
      <DefinitionEditor
        template={tpl}
        observationClass="watcher"
        scopePicker={<div data-testid="watcher-scope-picker">watcher-scope</div>}
        scopeLocked={false}
        scopeValue={tpl.scope}
        onScopeChange={vi.fn()}
        endpointBase="/api/account/sonar/watchers/definitions"
        listRoute="/account/sonar/watchers"
      />,
    );
  }

  it('renders a Drift step for watcher observation_class', async () => {
    renderWatcherEditor();
    expect(
      screen.getByRole('heading', { name: 'Drift detection' }),
    ).toBeInTheDocument();
    // Knobs are collapsed by default behind the "Alter" toggle.
    expect(screen.queryByLabelText(/Noise floor/i)).not.toBeInTheDocument();
    await userEvent.click(
      screen.getByRole('button', { name: /Alter drift thresholds/i }),
    );
    expect(screen.getByLabelText(/Noise floor/i)).toBeInTheDocument();
  });

  it('does NOT render a Drift step for audit observation_class', () => {
    renderAuditEditor();
    expect(
      screen.queryByRole('heading', { name: 'Drift detection' }),
    ).toBeNull();
  });

  it('locks the Drift step when cadence is manual_only', () => {
    const manualWatcher = {
      ...watcherTemplate,
      cadence: { kind: 'manual_only' as const },
    } as RunTemplate;
    renderWatcherEditor({ template: manualWatcher });
    expect(
      screen.getByText(/Drift detection requires a scheduled cadence/i),
    ).toBeInTheDocument();
    // Locked cadence hides the editor entirely — there's nothing to tune
    // until the watcher is on a schedule.
    expect(
      screen.queryByRole('button', { name: /Alter drift thresholds/i }),
    ).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Noise floor/i)).not.toBeInTheDocument();
  });

  it('triggers the save bar when drift thresholds change', async () => {
    renderWatcherEditor();
    // No save bar at initial render (drift_thresholds === DEFAULT).
    expect(screen.queryByRole('button', { name: /save changes/i })).toBeNull();
    // Expand the collapsed section, then bump the noise floor by typing.
    await userEvent.click(
      screen.getByRole('button', { name: /Alter drift thresholds/i }),
    );
    const noise = screen.getByLabelText(/Noise floor/i);
    await userEvent.clear(noise);
    await userEvent.type(noise, '7');
    expect(
      screen.getByRole('button', { name: /save changes/i }),
    ).toBeInTheDocument();
  });

  it('merges drift_thresholds into scope on PATCH', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({}) } as Response);
    renderWatcherEditor();
    await userEvent.click(
      screen.getByRole('button', { name: /Alter drift thresholds/i }),
    );
    const noise = screen.getByLabelText(/Noise floor/i);
    await userEvent.clear(noise);
    await userEvent.type(noise, '7');
    await userEvent.click(screen.getByRole('button', { name: /save changes/i }));
    const body = JSON.parse(
      (fetchMock.mock.calls[0][1] as RequestInit).body as string,
    );
    expect(body.scope).toBeDefined();
    expect(body.scope.drift_thresholds).toBeDefined();
    expect(body.scope.drift_thresholds.noise_floor_days).toBe(7);
    // scope still carries the original watcher fields too.
    expect(body.scope.kind).toBe('watcher');
    expect(body.scope.counterparties).toEqual(['acme-corp']);
  });
});
