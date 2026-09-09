'use client';

import { useEffect, useRef, useState } from 'react';
import { parseWorkbook, MAX_IMPORT_BYTES, type ParsedDocument } from '@/lib/scope-import/parse-workbook';
import {
  classifyCompanies,
  type CompanyClassification,
  type UniverseOption,
} from '@/lib/scope-import/classify-companies';
import {
  READING,
  SELECT_LABEL,
  SELECT_PLACEHOLDER,
  catalogFailureLine,
  companyOptionLabel,
  matchSummary,
  membershipLine,
  notAcceptedLine,
  notInCatalogLine,
  parsedSummary,
} from '@/lib/scope-import/import-copy';
import type { ImportResult } from '@/lib/scope-import/import-types';

/**
 * Scope from document (HaiWeb v1.90 PR 1, spec §4). Sits above the
 * counterparty ▸ class ▸ SKU tree in both wizards. Parses the chosen
 * spreadsheet IN THE BROWSER, classifies its companies against the picker's
 * universe + the participant directory, and lets the user pick one pickable
 * company to import. The membership lines are informational only.
 * Every failure is said in place; none blocks manual checking below.
 */
export interface ScopeImportPanelProps {
  universe: 'bilateral_connections' | 'accepted_audit_scopes';
  options: UniverseOption[] | null;
  onImport: (counterpartyId: string, skus: string[], companyName: string) => void;
  result: (ImportResult & { companyName: string }) | null;
  importing: boolean;
}

type Phase =
  | { kind: 'idle' }
  | { kind: 'reading'; fileName: string }
  | { kind: 'refused'; detail: string }
  | { kind: 'ready'; fileName: string; document: ParsedDocument; companies: CompanyClassification[] };

const ACCEPT =
  '.xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv';

async function fetchSelfNames(): Promise<string[]> {
  try {
    const res = await fetch('/api/account/profile');
    if (!res.ok) return [];
    const body = (await res.json()) as { legal_name?: string; dba_name?: string | null };
    return [body.legal_name, body.dba_name].filter((s): s is string => typeof s === 'string' && s.length > 0);
  } catch {
    return [];
  }
}

async function directoryLookup(name: string): Promise<Array<{ company_name: string }>> {
  const res = await fetch(`/api/account/directory?q=${encodeURIComponent(name)}`);
  if (!res.ok) throw new Error(`directory ${res.status}`);
  const body: unknown = await res.json();
  if (!Array.isArray(body)) return [];
  return body.filter(
    (r): r is { company_name: string } =>
      typeof r === 'object' && r !== null && typeof (r as { company_name?: unknown }).company_name === 'string',
  );
}

export function ScopeImportPanel({ universe, options, onImport, result, importing }: ScopeImportPanelProps) {
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  const [choice, setChoice] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  // Re-classify if the universe arrives after the file was parsed.
  const [rawDoc, setRawDoc] = useState<{ fileName: string; document: ParsedDocument } | null>(null);

  useEffect(() => {
    if (!rawDoc || !options) return;
    let cancelled = false;
    (async () => {
      const selfNames = await fetchSelfNames();
      const companies = await classifyCompanies(rawDoc.document, { universe: options, selfNames, lookup: directoryLookup });
      if (!cancelled) setPhase({ kind: 'ready', fileName: rawDoc.fileName, document: rawDoc.document, companies });
    })();
    return () => {
      cancelled = true;
    };
  }, [rawDoc, options]);

  async function onFile(file: File | undefined) {
    setChoice('');
    if (!file) {
      setRawDoc(null);
      setPhase({ kind: 'idle' });
      return;
    }
    setPhase({ kind: 'reading', fileName: file.name });
    const bytes = await file.arrayBuffer();
    const out = await parseWorkbook(bytes, { fileName: file.name, maxBytes: MAX_IMPORT_BYTES });
    if (!out.ok) {
      setRawDoc(null);
      setPhase({ kind: 'refused', detail: out.detail });
      return;
    }
    setRawDoc({ fileName: file.name, document: out.document });
  }

  const ready = phase.kind === 'ready' ? phase : null;
  const visible = ready ? ready.companies.filter((c) => c.membership !== 'self') : [];
  const pickable = visible.filter((c) => c.membership === 'pickable');
  const names = (m: CompanyClassification['membership']) => visible.filter((c) => c.membership === m).map((c) => c.name);

  return (
    <section className="rounded border border-slate/20 bg-white px-3 py-3 space-y-2" aria-label="Import from spreadsheet">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm font-medium text-charcoal">Import from spreadsheet</span>
        <label className="cursor-pointer rounded border border-teal px-3 py-1 text-sm text-teal hover:bg-teal/5 focus-within:ring-2 focus-within:ring-teal">
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT}
            className="peer sr-only"
            aria-label="Choose a spreadsheet"
            onChange={(e) => void onFile(e.target.files?.[0])}
          />
          Choose file…
        </label>
        {phase.kind !== 'idle' && (
          <button
            type="button"
            className="text-sm text-slate underline"
            onClick={() => {
              if (inputRef.current) inputRef.current.value = '';
              void onFile(undefined);
            }}
          >
            Clear
          </button>
        )}
      </div>

      {phase.kind === 'reading' && <p className="text-sm text-slate italic">{READING(phase.fileName)}</p>}
      {phase.kind === 'refused' && <p className="text-sm text-charcoal">{phase.detail}</p>}

      {ready && (
        <div className="space-y-1 text-sm text-slate">
          <p>
            {parsedSummary(
              ready.fileName,
              ready.document.rows.length,
              ready.companies.length,
              ready.document.skipped,
            )}
          </p>
          {(['not_on_network', 'on_network_unconnected', 'unverified'] as const).map((kind) => {
            const line = membershipLine(kind, names(kind));
            return line ? <p key={kind}>{line}</p> : null;
          })}
          <label className="flex flex-wrap items-center gap-2 pt-1 text-charcoal">
            <span>{SELECT_LABEL}</span>
            <select
              className="rounded border border-slate/30 px-2 py-1 text-sm"
              value={choice}
              disabled={importing || pickable.length === 0}
              onChange={(e) => {
                const id = e.target.value;
                setChoice(id);
                const c = pickable.find((p) => p.counterpartyId === id);
                if (c && c.counterpartyId) onImport(c.counterpartyId, c.skus, c.name);
              }}
            >
              <option value="">{SELECT_PLACEHOLDER}</option>
              {pickable.map((c) => (
                <option key={c.counterpartyId} value={c.counterpartyId}>
                  {companyOptionLabel(c.name, c.skus.length)}
                </option>
              ))}
            </select>
            {pickable.length === 0 && (
              <span>
                {universe === 'bilateral_connections'
                  ? 'None of the file’s companies is one of your active trading pairs.'
                  : 'None of the file’s companies has an accepted audit scope with you.'}
              </span>
            )}
          </label>
          {result && (
            <div className="space-y-1">
              {result.error ? (
                <p>{catalogFailureLine(result.companyName)}</p>
              ) : (
                <>
                  <p>
                    {matchSummary(
                      result.companyName,
                      result.matched.length,
                      result.matched.length + result.notInCatalog.length + result.notAccepted.length,
                    )}
                  </p>
                  {notInCatalogLine(result.companyName, result.notInCatalog) && (
                    <p>{notInCatalogLine(result.companyName, result.notInCatalog)}</p>
                  )}
                  {notAcceptedLine(result.notAccepted) && <p>{notAcceptedLine(result.notAccepted)}</p>}
                </>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
