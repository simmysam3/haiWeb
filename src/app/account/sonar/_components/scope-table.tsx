'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import type { AuditScope } from '@haiwave/protocol';
import { DataTable, type Column } from '@/components';
import { IdChip } from '@/components/id-chip';
import { describeApiError, type ApiErrorInfo } from '@/lib/api-error';
import { FormError } from '@/components/form-error';

export function ScopeTable({
  initialScopes,
  emptyMessage,
}: {
  initialScopes: AuditScope[];
  emptyMessage?: ReactNode;
}) {
  const [scopes, setScopes] = useState<AuditScope[]>(initialScopes);
  const [showDisabled, setShowDisabled] = useState(false);
  const [actionError, setActionError] = useState<ApiErrorInfo | null>(null);

  const disabledCount = scopes.filter((s) => s.disabled_at).length;
  const visibleScopes = showDisabled ? scopes : scopes.filter((s) => !s.disabled_at);

  // Revoking a counterparty's audit authorization must be visibly refused
  // when it is refused: the row changes only after the BFF said 2xx/204.
  async function disable(id: string) {
    setActionError(null);
    let res: Response;
    try {
      res = await fetch(`/api/account/audit-scopes/${id}`, { method: 'DELETE' });
    } catch {
      setActionError({ status: 0, sessionExpired: false, message: 'Could not reach the server. The scope is still active.' });
      return;
    }
    if (!res.ok && res.status !== 204) {
      setActionError(await describeApiError(res));
      return;
    }
    setScopes((s) =>
      s.map((x) =>
        x.scope_id === id
          ? { ...x, disabled_at: new Date().toISOString() }
          : x,
      ),
    );
  }

  const columns: Column<AuditScope>[] = [
    {
      key: 'vendor',
      label: 'Vendor',
      render: (s) =>
        s.vendor_legal_name ? (
          <span title={s.vendor_participant_id}>{s.vendor_legal_name}</span>
        ) : (
          <IdChip id={s.vendor_participant_id} />
        ),
    },
    {
      key: 'scope',
      label: 'Scope',
      render: (s) => {
        const ref = s.scope_label ?? s.scope_ref;
        return (
          <>
            {s.scope_type}
            {ref ? ` / ${ref}` : ''}
          </>
        );
      },
    },
    {
      key: 'created',
      label: 'Created',
      nowrap: true,
      render: (s) => new Date(s.created_at).toLocaleDateString(),
    },
    {
      key: 'status',
      label: 'Status',
      nowrap: true,
      render: (s) =>
        s.disabled_at ? (
          <span className="text-slate">disabled</span>
        ) : (
          <span className="text-teal">active</span>
        ),
    },
    {
      key: 'actions',
      label: '',
      align: 'right',
      nowrap: true,
      render: (s) =>
        s.disabled_at ? null : (
          <button
            onClick={() => disable(s.scope_id)}
            className="text-xs text-[var(--color-problem)] hover:underline"
          >
            Disable
          </button>
        ),
    },
  ];

  const toolbar =
    disabledCount > 0 ? (
      <button
        type="button"
        onClick={() => setShowDisabled((v) => !v)}
        className="text-xs text-teal hover:text-navy"
      >
        {showDisabled ? 'Hide' : 'Show'} disabled ({disabledCount})
      </button>
    ) : null;

  const filteredEmpty =
    scopes.length > 0 && !showDisabled ? (
      <>
        Only disabled scopes here. Toggle <em>Show disabled</em> to view them.
      </>
    ) : (
      emptyMessage ?? (
        <>
          No scopes yet. Configure from a{' '}
          <Link
            href="/account/partners"
            className="text-teal underline hover:text-navy"
          >
            Partner&apos;s Catalog
          </Link>{' '}
          tab.
        </>
      )
    );

  return (
    <div className="space-y-3">
      {actionError && (
        <FormError message={actionError.message} sessionExpired={actionError.sessionExpired} />
      )}
      <DataTable
        columns={columns}
        data={visibleScopes}
        keyFn={(s) => s.scope_id}
        emptyMessage={filteredEmpty}
        toolbar={toolbar}
      />
    </div>
  );
}
