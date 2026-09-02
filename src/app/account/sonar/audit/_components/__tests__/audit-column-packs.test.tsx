import '@testing-library/jest-dom/vitest';
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { RunTemplate } from '@haiwave/protocol';
import { auditConfigurationsColumnPack } from '../audit-column-packs';

// v1.85 — parity with the watchers list: the Scheduled configurations table's
// Actions cell is a labelled menu (View runs / Edit configuration) rather than
// a lone "Edit" link, and the name link says where it goes.

type AuditTemplate = Extract<RunTemplate, { observation_class: 'audit' }>;

function makeTemplate(): AuditTemplate {
  return {
    template_id: 'a-1',
    template_name: 'Weekly EMEA Audit',
    observation_class: 'audit',
    cadence: { kind: 'weekly', day_of_week: 'mon', time_of_day: '06:00' },
    enabled: true,
    retention_days: 90,
    created_at: '2026-05-08T12:00:00.000Z',
    last_run_at: null,
    scope: {
      kind: 'audit',
      authorization_basis: 'bilateral',
      counterparties: ['acme-corp'],
      signal_types: [],
      skus: [],
      depth_limit: 3,
    },
  } as unknown as AuditTemplate;
}

function renderCell(key: string) {
  const col = auditConfigurationsColumnPack.columns.find((c) => c.key === key);
  if (!col) throw new Error(`${key} column missing from audit configurations pack`);
  return render(<>{col.render(makeTemplate())}</>);
}

describe('audit-configurations column pack — actions cell', () => {
  it('renders an Actions menu named for the audit instead of a bare Edit link', () => {
    renderCell('actions');
    expect(screen.getByRole('button', { name: 'Actions for Weekly EMEA Audit' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Edit' })).not.toBeInTheDocument();
  });

  it('offers View runs and Edit configuration, each deep-linking to its tab', () => {
    renderCell('actions');
    fireEvent.click(screen.getByRole('button', { name: 'Actions for Weekly EMEA Audit' }));
    expect(screen.getByRole('menuitem', { name: 'View runs' })).toHaveAttribute(
      'href',
      '/account/sonar/audit/definitions/a-1?tab=runs',
    );
    expect(screen.getByRole('menuitem', { name: 'Edit configuration' })).toHaveAttribute(
      'href',
      '/account/sonar/audit/definitions/a-1?tab=configuration',
    );
  });
});

describe('audit-configurations column pack — name cell', () => {
  it('links to the audit page and says what is there', () => {
    renderCell('name');
    const link = screen.getByRole('link', { name: 'Weekly EMEA Audit' });
    expect(link).toHaveAttribute('href', '/account/sonar/audit/definitions/a-1');
    expect(link).toHaveAttribute('title', 'Open audit: run history and configuration');
  });
});
