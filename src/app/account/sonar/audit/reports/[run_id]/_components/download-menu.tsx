'use client';

import { useEffect, useRef, useState } from 'react';

type Props =
  | { runId: string; reportType: 'aggregate' }
  | { runId: string; reportType: 'per_vendor'; vendorId: string };

function buildUrls(props: Props): { json: string; csv: string; jsonName: string; csvName: string } {
  if (props.reportType === 'aggregate') {
    const base = `/api/account/sonar/audit/reports/${props.runId}/aggregate`;
    return {
      json: `${base}?format=json`,
      csv: `${base}?format=csv`,
      jsonName: `aggregate-${props.runId}.json`,
      csvName: `aggregate-${props.runId}.csv`,
    };
  }
  const base = `/api/account/sonar/audit/reports/${props.runId}/vendor/${props.vendorId}`;
  return {
    json: `${base}?format=json`,
    csv: `${base}?format=csv`,
    jsonName: `per-vendor-${props.runId}-${props.vendorId}.json`,
    csvName: `per-vendor-${props.runId}-${props.vendorId}.csv`,
  };
}

export function DownloadMenu(props: Props) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const { json, csv, jsonName, csvName } = buildUrls(props);

  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={containerRef} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="rounded-md border border-teal text-teal px-3 py-1.5 text-sm hover:bg-teal/5"
      >
        Download <span className="text-xs">▾</span>
      </button>
      {open && (
        <div className="absolute right-0 top-9 z-10 min-w-[140px] rounded-md border border-slate/20 bg-white py-1 shadow-md">
          <a
            href={json}
            download={jsonName}
            onClick={() => setOpen(false)}
            className="block px-3 py-1.5 text-sm text-charcoal hover:bg-light-gray/40"
          >
            JSON
          </a>
          <a
            href={csv}
            download={csvName}
            onClick={() => setOpen(false)}
            className="block px-3 py-1.5 text-sm text-charcoal hover:bg-light-gray/40"
          >
            CSV
          </a>
        </div>
      )}
    </div>
  );
}
