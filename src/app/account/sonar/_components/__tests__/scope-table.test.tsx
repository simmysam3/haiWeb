import '@testing-library/jest-dom/vitest';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { AuditScope } from '@haiwave/protocol';
import { ScopeTable } from '../scope-table';

function scope(overrides: Partial<AuditScope>): AuditScope {
  return {
    scope_id: '11111111-1111-4111-8111-111111111111',
    initiator_participant_id: '22222222-2222-4222-8222-222222222222',
    vendor_participant_id: '33333333-3333-4333-8333-333333333333',
    vendor_legal_name: 'Vendor Co',
    scope_type: 'company',
    scope_ref: null,
    created_at: '2026-07-21T00:00:00.000Z',
    created_by_user_id: null,
    disabled_at: null,
    disabled_by_user_id: null,
    acceptance_status: 'accepted',
    responder_decided_at: null,
    decision_reason: null,
    ...overrides,
  };
}

describe('ScopeTable', () => {
  it('renders scope_label for class scopes instead of the raw node id', () => {
    const nodeId = 'b3478126-c2c3-446d-9d6b-3c73c622febd';
    render(
      <ScopeTable
        initialScopes={[
          scope({
            scope_id: '44444444-4444-4444-8444-444444444444',
            scope_type: 'class',
            scope_ref: nodeId,
            scope_label: 'Aircraft engine interface units',
          }),
        ]}
      />,
    );
    expect(screen.getByText(/Aircraft engine interface units/)).toBeInTheDocument();
    expect(screen.queryByText(new RegExp(nodeId))).not.toBeInTheDocument();
  });

  it('falls back to scope_ref when no label is present', () => {
    render(
      <ScopeTable
        initialScopes={[
          scope({
            scope_id: '55555555-5555-4555-8555-555555555555',
            scope_type: 'product',
            scope_ref: 'SKU-4711',
          }),
        ]}
      />,
    );
    expect(screen.getByText(/SKU-4711/)).toBeInTheDocument();
  });
});
