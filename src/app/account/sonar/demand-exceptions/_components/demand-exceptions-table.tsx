'use client';

import { useState } from 'react';
import Link from 'next/link';
import { formatRelative } from '@/components/sonar/observations/format';
import { smFetch } from '@/lib/sourcing-map/client';
import { CAUSE_PILLS, figureText, requestStatusText, windowText } from '@/lib/sourcing-map/backlogs';
import { EM_DASH, formatQty } from '@/lib/sourcing-map/map/selectors';
import type { SmDemandException, SmDemandExceptionListResponse } from '@/lib/sourcing-map/types';
import { BacklogTable, type BacklogColumn } from '../../_components/backlog-table';
import { useRenderMeasure } from '../../_components/use-render-measure';

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

  const columns: BacklogColumn<SmDemandException>[] = [
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
          {/* A repeat carries the newest run's figures, window and short week (haiCore backlog-deriver overwrites them). */}
          {r.count > 1 && <div className="text-xs text-slate">{`latest of ${r.count} runs`}</div>}
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
      <BacklogTable columns={columns} data={rows} keyFn={(r) => r.exception_id} emptyMessage="No demand exceptions." />
      {nextHref !== null && (
        <p className="mt-3">
          <Link href={nextHref} className="text-sm font-medium text-teal-dark hover:text-navy">Show older</Link>
        </p>
      )}
    </div>
  );
}
