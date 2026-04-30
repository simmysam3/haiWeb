'use client';

import { useEffect, useRef, useState } from 'react';

type Props =
  | { windowId: string; reportType: 'aggregate' }
  | { windowId: string; reportType: 'per_counterparty'; counterpartyId: string };

type Format = 'json' | 'csv' | 'pdf';

interface FormatLink {
  href: string;
  download: string;
}

type Links = Record<Format, FormatLink>;

function buildLinks(props: Props): Links {
  if (props.reportType === 'aggregate') {
    const base = `/api/account/sonar/phantom-demand/reports/${props.windowId}/aggregate`;
    return {
      json: {
        href: `${base}?format=json`,
        download: `phantom-demand-aggregate-${props.windowId}.json`,
      },
      csv: {
        href: `${base}?format=csv`,
        download: `phantom-demand-aggregate-${props.windowId}.csv`,
      },
      pdf: {
        href: `${base}?format=pdf`,
        download: `phantom-demand-aggregate-${props.windowId}.pdf`,
      },
    };
  }
  const base = `/api/account/sonar/phantom-demand/reports/${props.windowId}/counterparty/${props.counterpartyId}`;
  return {
    json: {
      href: `${base}?format=json`,
      download: `phantom-demand-${props.windowId}-${props.counterpartyId}.json`,
    },
    csv: {
      href: `${base}?format=csv`,
      download: `phantom-demand-${props.windowId}-${props.counterpartyId}.csv`,
    },
    pdf: {
      href: `${base}?format=pdf`,
      download: `phantom-demand-${props.windowId}-${props.counterpartyId}.pdf`,
    },
  };
}

const FORMATS: readonly Format[] = ['json', 'csv', 'pdf'];

/**
 * Phantom-demand-specific DownloadMenu sibling. Mirrors the audit
 * DownloadMenu (same UX, same loading-indicator semantics) but routes to
 * the phantom-demand BFF and uses phantom-demand filename conventions.
 *
 * Plan §7.4 chose a sibling over parameterizing the audit menu for clarity:
 * phantom demand uses `windowId` / `counterpartyId` instead of
 * `runId` / `vendorId`.
 */
export function DownloadMenu(props: Props) {
  const [open, setOpen] = useState(false);
  const [downloading, setDownloading] = useState<Format | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const links = buildLinks(props);

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

  useEffect(() => {
    if (downloading === null) return;
    const t = setTimeout(() => setDownloading(null), 4000);
    return () => clearTimeout(t);
  }, [downloading]);

  function onFormatClick(format: Format) {
    setDownloading(format);
    setOpen(false);
  }

  return (
    <div ref={containerRef} className="relative inline-block">
      <button
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        disabled={downloading !== null}
        className="rounded-md border border-teal text-teal px-3 py-1.5 text-sm hover:bg-teal/5 disabled:opacity-60"
      >
        {downloading !== null ? (
          <>Generating {downloading.toUpperCase()}…</>
        ) : (
          <>
            Download <span className="text-xs">▾</span>
          </>
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-9 z-10 min-w-[140px] rounded-md border border-slate/20 bg-white py-1 shadow-md">
          {FORMATS.map((fmt) => (
            <a
              key={fmt}
              href={links[fmt].href}
              download={links[fmt].download}
              onClick={() => onFormatClick(fmt)}
              className="block px-3 py-1.5 text-sm text-charcoal hover:bg-light-gray/40"
            >
              {fmt.toUpperCase()}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
