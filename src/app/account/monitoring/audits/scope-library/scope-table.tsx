'use client';

import { useState } from 'react';
import type { AuditScope } from '@haiwave/protocol';

export function ScopeTable({
  initialScopes,
}: {
  initialScopes: AuditScope[];
}) {
  const [scopes, setScopes] = useState<AuditScope[]>(initialScopes);

  async function disable(id: string) {
    const res = await fetch(`/api/account/audit-scopes/${id}`, {
      method: 'DELETE',
    });
    if (res.ok || res.status === 204) {
      setScopes((s) =>
        s.map((x) =>
          x.scope_id === id
            ? { ...x, disabled_at: new Date().toISOString() }
            : x,
        ),
      );
    }
  }

  return (
    <table className="w-full text-sm">
      <thead className="text-left text-slate border-b border-slate/10">
        <tr>
          <th className="pb-2">Vendor</th>
          <th>Scope</th>
          <th>Created</th>
          <th>Status</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {scopes.map((s) => (
          <tr key={s.scope_id} className="border-b border-slate/5">
            <td className="py-2 font-mono text-xs">
              {s.vendor_participant_id}
            </td>
            <td>
              {s.scope_type}
              {s.scope_ref ? ` / ${s.scope_ref}` : ''}
            </td>
            <td>{new Date(s.created_at).toLocaleDateString()}</td>
            <td>
              {s.disabled_at ? (
                <span className="text-slate">disabled</span>
              ) : (
                <span className="text-teal">active</span>
              )}
            </td>
            <td>
              {!s.disabled_at && (
                <button
                  onClick={() => disable(s.scope_id)}
                  className="text-xs text-[var(--color-problem)] underline"
                >
                  Disable
                </button>
              )}
            </td>
          </tr>
        ))}
        {scopes.length === 0 && (
          <tr>
            <td colSpan={5} className="py-4 text-slate text-center">
              No scopes yet. Configure from a Partner&apos;s Catalog tab.
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
}
