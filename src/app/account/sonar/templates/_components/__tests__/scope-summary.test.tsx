import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { RunTemplateScope } from '@haiwave/protocol';
import { ScopeSummary } from '../scope-summary';

describe('ScopeSummary', () => {
  it('audit bilateral: shows counterparties, signal-type pills, depth, auth', () => {
    const scope: RunTemplateScope = {
      kind: 'audit',
      authorization_basis: 'bilateral',
      counterparties: ['acme-corp'],
      signal_types: ['lead_time_distribution'],
      skus: ['SKU-1'],
      depth_limit: 2,
      hop_budget: 5,
    };
    render(<ScopeSummary scope={scope} />);
    expect(screen.getByText('acme-corp')).toBeInTheDocument();
    expect(screen.getByText('Lead time distribution')).toBeInTheDocument();
    expect(screen.getByText('SKU-1')).toBeInTheDocument();
    expect(screen.getByText(/bilateral/i)).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('audit key_scoped: shows the provenance key, not counterparties', () => {
    const scope: RunTemplateScope = {
      kind: 'audit',
      authorization_basis: 'key_scoped',
      provenance_key_id: 'key-123',
      depth_limit: 1,
      hop_budget: 5,
    };
    render(<ScopeSummary scope={scope} />);
    expect(screen.getByText('key-123')).toBeInTheDocument();
    expect(screen.queryByText(/counterparties/i)).not.toBeInTheDocument();
  });

  it('watcher: lists signal types and depth', () => {
    const scope: RunTemplateScope = {
      kind: 'watcher',
      authorization_basis: 'bilateral',
      counterparties: [],
      signal_types: ['capacity_utilization_band'],
      depth_limit: 3,
    };
    render(<ScopeSummary scope={scope} />);
    expect(screen.getByText('Capacity utilization band')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('phantom_demand: shows counterparty, skus, quantity', () => {
    const scope: RunTemplateScope = {
      kind: 'phantom_demand',
      authorization_basis: 'bilateral',
      counterparty: 'globex',
      skus: ['SKU-9'],
      hypothetical_quantity: 100,
      hypothetical_timeline: null,
    };
    render(<ScopeSummary scope={scope} />);
    expect(screen.getByText('globex')).toBeInTheDocument();
    expect(screen.getByText('SKU-9')).toBeInTheDocument();
    expect(screen.getByText('100')).toBeInTheDocument();
  });

  it('renders an explicit empty state for empty arrays', () => {
    // Cast needed: WatcherScope.signal_types is nonempty() in the protocol schema,
    // but this test intentionally exercises the empty-array UI branch.
    const scope = {
      kind: 'watcher',
      authorization_basis: 'bilateral',
      counterparties: [],
      signal_types: [],
      depth_limit: 1,
    } as unknown as RunTemplateScope;
    render(<ScopeSummary scope={scope} />);
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
  });
});
