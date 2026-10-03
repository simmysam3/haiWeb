'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { formatRelative } from '@/components/sonar/observations/format';
import { smFetch } from '@/lib/sourcing-map/client';
import { CAUSE_PILLS, figureText, requestStatusText, windowText } from '@/lib/sourcing-map/backlogs';
import { EM_DASH, formatQty } from '@/lib/sourcing-map/map/selectors';
import type { SmDemandException, SmDemandExceptionListResponse } from '@/lib/sourcing-map/types';
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

const IGNORE_FAILED = `Couldn't ignore ${EM_DASH} the row is unchanged.`;

export function DemandExceptionsTable({ initial, nextHref }: {
  initial: SmDemandExceptionListResponse;
  nextHref: string | null;
}) {
  useRenderMeasure('sm-demand-exceptions-render');
  const [rows, setRows] = useState<SmDemandException[]>(initial.exceptions);
  const [ignoring, setIgnoring] = useState<ReadonlySet<string>>(new Set());
  const [failed, setFailed] = useState(false);

  async function ignore(id: string) {
    setIgnoring((s) => new Set(s).add(id));
    setFailed(false);
    const res = await smFetch<null>(`/api/account/sourcing-map/demand-exceptions/${id}/ignore`, { method: 'POST' });
    if (res.ok) setRows((rs) => rs.filter((r) => r.exception_id !== id));
    else setFailed(true);
    setIgnoring((s) => {
      const next = new Set(s);
      next.delete(id);
      return next;
    });
  }

  const columns: Column<SmDemandException>[] = [
    { key: 'requestor', label: 'Requestor', render: (r) => r.requestor.name },
    { key: 'product', label: 'Product', render: (r) => r.sku },
    {
      key: 'asked',
      label: 'Asked',
      align: 'right',
      render: (r) => (
        <>
          <div>{formatQty(r.asked)}</div>
          <div className="text-xs text-slate">{windowText(r.window)}</div>
        </>
      ),
    },
    { key: 'answered', label: 'Answered / gap', align: 'right', nowrap: true, render: (r) => `${figureText(r.answered)} / ${figureText(r.gap)}` },
    {
      key: 'cause',
      label: 'Cause',
      render: (r) => (
        <>
          <div>{CAUSE_PILLS.find((p) => p.value === r.cause)?.label ?? r.cause}</div>
          {r.cause === 'chain' && <div className="text-xs text-slate">an input of yours ran short</div>}
          {r.cause === 'posture' && (
            <Link href="/account/settings/trust-posture" className="text-xs font-medium text-teal-dark hover:text-navy">Trust posture</Link>
          )}
        </>
      ),
    },
    { key: 'count', label: 'Times', render: (r) => `×${r.count}` },
    { key: 'age', label: 'Age and status', render: (r) => `${formatRelative(r.first_filed_at)} · ${requestStatusText(r.request_status)}` },
    {
      key: 'ignore',
      label: '',
      render: (r) => (
        <button
          type="button"
          className="text-xs font-medium text-teal-dark hover:text-navy disabled:opacity-50"
          disabled={ignoring.has(r.exception_id)}
          onClick={() => void ignore(r.exception_id)}
        >
          Ignore
        </button>
      ),
    },
  ];

  return (
    <div>
      {failed && <p role="alert" className="mb-2 text-sm text-red-900">{IGNORE_FAILED}</p>}
      <LocalTable columns={columns} data={rows} keyFn={(r) => r.exception_id} emptyMessage="No demand exceptions." />
      {nextHref !== null && (
        <p className="mt-3">
          <Link href={nextHref} className="text-sm font-medium text-teal-dark hover:text-navy">Show older</Link>
        </p>
      )}
    </div>
  );
}
