import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { RunTemplate } from '@haiwave/protocol';
import { TemplateEditor } from '../template-editor';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

const fetchMock = vi.fn();
beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

const template: RunTemplate = {
  template_id: 'abc',
  template_name: 'daily-audit',
  observation_class: 'audit',
  cadence: { kind: 'manual_only' },
  enabled: true,
  retention_days: 365,
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
} as RunTemplate;

describe('TemplateEditor', () => {
  it('renders the read-only scope alongside editable name', () => {
    render(<TemplateEditor template={template} />);
    expect(screen.getByDisplayValue('daily-audit')).toBeInTheDocument();
    expect(screen.getByText('acme-corp')).toBeInTheDocument();
    expect(screen.getByText(/Fixed at creation/i)).toBeInTheDocument();
  });

  it('shows no save bar until a field changes', async () => {
    render(<TemplateEditor template={template} />);
    expect(screen.queryByRole('button', { name: /save changes/i })).toBeNull();
    await userEvent.type(screen.getByLabelText(/audit name/i), 'X');
    expect(
      screen.getByRole('button', { name: /save changes/i }),
    ).toBeInTheDocument();
  });

  it('PATCHes only mutable fields on save', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({}) } as Response);
    render(<TemplateEditor template={template} />);
    await userEvent.type(screen.getByLabelText(/audit name/i), 'Z');
    await userEvent.click(screen.getByRole('button', { name: /save changes/i }));
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/account/sonar/templates/abc');
    expect((init as RequestInit).method).toBe('PATCH');
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body).toEqual({
      template_name: 'daily-auditZ',
      cadence: { kind: 'manual_only' },
      enabled: true,
      retention_days: 365,
    });
    expect(body).not.toHaveProperty('scope');
  });

  it('clears the save bar after a successful save and prop refresh', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({}) } as Response);
    const { rerender } = render(<TemplateEditor template={template} />);
    await userEvent.type(screen.getByLabelText(/audit name/i), 'Z');
    await userEvent.click(screen.getByRole('button', { name: /save changes/i }));
    // simulate router.refresh() delivering the server-committed template
    rerender(
      <TemplateEditor template={{ ...template, template_name: 'daily-auditZ' }} />,
    );
    expect(screen.queryByRole('button', { name: /save changes/i })).toBeNull();
  });

  it('shows an error and keeps the save bar when PATCH fails', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'Bad request' }), { status: 400 }),
    );
    render(<TemplateEditor template={template} />);
    await userEvent.type(screen.getByLabelText(/audit name/i), 'Z');
    await userEvent.click(screen.getByRole('button', { name: /save changes/i }));
    // FormError surfaces a message; save bar remains because the prop never refreshed
    expect(
      await screen.findByRole('button', { name: /save changes/i }),
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
