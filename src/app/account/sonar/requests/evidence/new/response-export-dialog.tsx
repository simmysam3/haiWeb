'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { EvidenceRecipientType } from './evidence-protocol-mirror';

interface ExportResult {
  response_id: string;
  document_hash: string;
}

interface Props {
  draftId: string;
  recipientName: string;
  recipientType: EvidenceRecipientType;
  sourceRunSummary: string;
}

/**
 * v1.34 P9: Export action for the review stage.
 * POSTs to the BFF export endpoint; surfaces response_id + hash +
 * document format download links on success, or an explicit error
 * banner (incl. 403 → export-role message) on failure.
 * Mirrors dispatch-decision-panel.tsx's fetch/error-surfacing idiom.
 */
export function ResponseExportDialog({ draftId, recipientName, recipientType, sourceRunSummary }: Props) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ExportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [is403, setIs403] = useState(false);

  const docBase = `/api/account/sonar/compliance/evidence/responses`;

  async function handleExport() {
    setBusy(true);
    setError(null);
    setIs403(false);
    try {
      const res = await fetch(
        `/api/account/sonar/compliance/evidence/draft/${encodeURIComponent(draftId)}/export`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        },
      );
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        const msg = j?.error?.message ?? j?.error ?? `Export failed (${res.status})`;
        if (res.status === 403) {
          setIs403(true);
          setError(String(msg));
        } else {
          setError(String(msg));
        }
        return;
      }
      const data = (await res.json()) as ExportResult;
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Export failed — network error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded border border-slate/20 p-4 space-y-3 mt-4">
      <div>
        <h3 className="font-semibold text-charcoal">Export evidence package</h3>
        <p className="text-sm text-slate mt-1">
          Recipient: <strong>{recipientName}</strong> ({recipientType}) · {sourceRunSummary}
        </p>
      </div>

      {!result && (
        <button
          type="button"
          disabled={busy}
          onClick={() => void handleExport()}
          className="px-4 py-2 rounded bg-charcoal text-white text-sm font-medium disabled:opacity-50"
        >
          {busy ? 'Exporting…' : 'Export'}
        </button>
      )}

      {is403 && (
        <div className="rounded border border-problem/30 bg-problem/5 px-4 py-3 text-sm text-problem">
          Export requires the export role (EVIDENCE_EXPORT_WRITE). Ask an approver to export.
          {error && error !== 'Forbidden' && <span className="ml-1 text-slate">({error})</span>}
        </div>
      )}

      {!is403 && error && (
        <div className="text-sm text-problem">{error}</div>
      )}

      {result && (
        <div className="space-y-3">
          <div className="text-sm">
            <span className="text-slate">Response ID:</span>{' '}
            <Link
              href={`/account/sonar/requests/evidence/responses/${result.response_id}`}
              className="font-mono text-teal hover:text-navy text-xs"
            >
              {result.response_id}
            </Link>
          </div>
          <div className="text-sm">
            <span className="text-slate">Hash:</span>{' '}
            <span className="font-mono text-xs text-charcoal" title={result.document_hash}>
              {result.document_hash.slice(0, 12)}…
            </span>
          </div>
          <div className="flex gap-2">
            {(['pdf', 'html', 'json'] as const).map((fmt) => (
              <a
                key={fmt}
                href={`${docBase}/${result.response_id}/document?format=${fmt}`}
                download
                className="px-3 py-1.5 rounded border border-teal text-teal hover:bg-teal hover:text-white text-xs font-medium transition-colors"
              >
                {fmt.toUpperCase()}
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
