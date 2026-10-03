'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { smFetch } from '@/lib/sourcing-map/client';
import { RISK_STATUS_PILLS, figureText, openMapHref, originText } from '@/lib/sourcing-map/backlogs';
import { EM_DASH, formatDay } from '@/lib/sourcing-map/map/selectors';
import type { SmSupplyRisk, SmSupplyRiskListResponse, SmSupplyRiskPatch, SmSupplyRiskStatus } from '@/lib/sourcing-map/types';
import { useRenderMeasure } from '../../_components/use-render-measure';

interface Column<T> {
  key: string;
  label: string;
  render: (row: T) => ReactNode;
  align?: 'left' | 'right';
  nowrap?: boolean;
}

/**
 * A local table in DataTable's markup (ruling C-11): DataTable's header text, slate on its grey, is 4.15:1, short of
 * the 4.5:1 axe requires; charcoal on the same grey clears it. Never edit the shared component for this lane.
 */
function LocalTable<T>({ columns, data, keyFn, emptyMessage }: {
  columns: Column<T>[];
  data: T[];
  keyFn: (row: T) => string;
  emptyMessage: string;
}) {
  const cell = (c: Column<T>) => `${c.align === 'right' ? 'text-right' : 'text-left'} ${c.nowrap ? 'whitespace-nowrap' : ''}`;
  return (
    <div className="overflow-x-auto rounded border border-slate/15">
      <table className="w-full text-sm">
        <thead className="bg-light-gray">
          <tr>
            {columns.map((c) => (
              <th key={c.key} className={`${cell(c)} text-xs font-medium uppercase tracking-wider text-charcoal py-2.5 px-4`}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="py-8 px-4 text-center text-sm text-slate">{emptyMessage}</td>
            </tr>
          ) : (
            data.map((row, i) => (
              <tr key={keyFn(row)} className={`${i > 0 ? 'border-t border-slate/10' : ''} hover:bg-light-gray/50`}>
                {columns.map((c) => (
                  <td key={c.key} className={`${cell(c)} py-2.5 px-4`}>{c.render(row)}</td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

const SAVE_FAILED = `Couldn't save ${EM_DASH} the risk is unchanged.`;
const FIELD = 'rounded border border-slate/30 bg-white px-2 py-1 text-xs';

type Field = 'status' | 'owner' | 'note' | 'next_review';

export function SupplyRisksTable({ initial, nextHref, seatUsers = null }: {
  initial: SmSupplyRiskListResponse;
  nextHref: string | null;
  seatUsers?: ReadonlyArray<{ user_id: string; name: string }> | null;
}) {
  useRenderMeasure('sm-supply-risks-render');
  const [rows, setRows] = useState<SmSupplyRisk[]>(initial.risks);
  // What the viewer has typed and not yet seen served; a failed save drops it, which is the revert.
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<ReadonlySet<string>>(new Set());
  const [failed, setFailed] = useState(false);

  async function save(risk: SmSupplyRisk, field: Field, draft: string, body: SmSupplyRiskPatch) {
    const key = `${risk.risk_id}:${field}`;
    setDrafts((d) => ({ ...d, [key]: draft }));
    setSaving((s) => new Set(s).add(key));
    setFailed(false);
    const res = await smFetch<SmSupplyRisk>(`/api/account/sourcing-map/supply-risks/${risk.risk_id}`, { method: 'PATCH', body });
    if (res.ok) setRows((rs) => rs.map((r) => (r.risk_id === risk.risk_id ? res.data : r)));
    else setFailed(true);
    setDrafts((d) => {
      const next = { ...d };
      delete next[key];
      return next;
    });
    setSaving((s) => {
      const next = new Set(s);
      next.delete(key);
      return next;
    });
  }

  const value = (r: SmSupplyRisk, field: Field, served: string) => drafts[`${r.risk_id}:${field}`] ?? served;
  const busy = (r: SmSupplyRisk, field: Field) => saving.has(`${r.risk_id}:${field}`);

  const columns: Column<SmSupplyRisk>[] = [
    { key: 'supplier', label: 'Supplier', render: (r) => r.supplier_name },
    {
      key: 'slot',
      label: 'Slot and products',
      render: (r) => (
        <>
          <div>{r.slot_label}</div>
          <div className="text-xs text-slate">{r.products.join(', ')}</div>
        </>
      ),
    },
    { key: 'figures', label: 'Requested / covered', align: 'right', nowrap: true, render: (r) => `${figureText(r.requested)} / ${figureText(r.covered)}` },
    { key: 'origin', label: 'Origin', render: (r) => originText(r.origin) },
    {
      key: 'status',
      label: 'Status',
      render: (r) => r.closed_at !== null
        ? RISK_STATUS_PILLS.find((p) => p.value === r.status)?.label ?? r.status
        : (
          <select
            aria-label={`Status for ${r.supplier_name}`}
            className={FIELD}
            value={value(r, 'status', r.status)}
            disabled={busy(r, 'status')}
            onChange={(e) => void save(r, 'status', e.target.value, { status: e.target.value as SmSupplyRiskStatus })}
          >
            {RISK_STATUS_PILLS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        ),
    },
    {
      key: 'owner',
      label: 'Owner',
      render: (r) => {
        if (r.closed_at !== null || seatUsers === null) return r.owner?.name ?? EM_DASH;
        // The current owner stays selectable even when the seat's list no longer holds them.
        const options = r.owner !== null && !seatUsers.some((u) => u.user_id === r.owner?.user_id)
          ? [...seatUsers, r.owner]
          : seatUsers;
        return (
          <select
            aria-label={`Owner for ${r.supplier_name}`}
            className={FIELD}
            value={value(r, 'owner', r.owner?.user_id ?? '')}
            disabled={busy(r, 'owner')}
            onChange={(e) => void save(r, 'owner', e.target.value, { owner_user_id: e.target.value === '' ? null : e.target.value })}
          >
            <option value="">Unassigned</option>
            {options.map((u) => <option key={u.user_id} value={u.user_id}>{u.name}</option>)}
          </select>
        );
      },
    },
    {
      key: 'note',
      label: 'Note',
      render: (r) => r.closed_at !== null
        ? r.note ?? EM_DASH
        : (
          <textarea
            aria-label={`Note for ${r.supplier_name}`}
            className={FIELD}
            maxLength={2000}
            rows={2}
            value={value(r, 'note', r.note ?? '')}
            disabled={busy(r, 'note')}
            onChange={(e) => setDrafts((d) => ({ ...d, [`${r.risk_id}:note`]: e.target.value }))}
            onBlur={() => {
              const text = value(r, 'note', r.note ?? '');
              if (text !== (r.note ?? '')) void save(r, 'note', text, { note: text === '' ? null : text });
            }}
          />
        ),
    },
    {
      key: 'next_review',
      label: 'Next review',
      nowrap: true,
      render: (r) => r.closed_at !== null
        ? r.next_review ? formatDay(r.next_review) : EM_DASH
        : (
          <input
            type="date"
            aria-label={`Next review for ${r.supplier_name}`}
            className={FIELD}
            value={value(r, 'next_review', r.next_review ?? '')}
            disabled={busy(r, 'next_review')}
            onChange={(e) => setDrafts((d) => ({ ...d, [`${r.risk_id}:next_review`]: e.target.value }))}
            onBlur={() => {
              // Saved on blur like the note: typing a year passes through valid dates (0002-11-09) on the way.
              const day = value(r, 'next_review', r.next_review ?? '');
              if (day !== (r.next_review ?? '')) void save(r, 'next_review', day, { next_review: day === '' ? null : day });
            }}
          />
        ),
    },
    {
      key: 'open_map',
      label: '',
      render: (r) => r.open_map === null
        ? EM_DASH
        : <Link href={openMapHref(r.open_map)} className="text-xs font-medium text-teal-dark hover:text-navy">Open map</Link>,
    },
  ];

  return (
    <div>
      {failed && <p role="alert" className="mb-2 text-sm text-red-900">{SAVE_FAILED}</p>}
      <LocalTable columns={columns} data={rows} keyFn={(r) => r.risk_id} emptyMessage="No supply risks." />
      {nextHref !== null && (
        <p className="mt-3">
          <Link href={nextHref} className="text-sm font-medium text-teal-dark hover:text-navy">Show older</Link>
        </p>
      )}
    </div>
  );
}
