'use client';

import { useEffect, useRef, useState } from 'react';

type Props =
  | { runId: string; reportType: 'aggregate' }
  | { runId: string; reportType: 'per_vendor'; vendorId: string };

type Format = 'json' | 'csv' | 'pdf';

interface FormatLink {
  href: string;
  download: string;
}

type Links = Record<Format, FormatLink>;

function buildLinks(props: Props): Links {
  if (props.reportType === 'aggregate') {
    const base = `/api/account/sonar/audit/reports/${props.runId}/aggregate`;
    return {
      json: { href: `${base}?format=json`, download: `aggregate-${props.runId}.json` },
      csv: { href: `${base}?format=csv`, download: `aggregate-${props.runId}.csv` },
      pdf: { href: `${base}?format=pdf`, download: `aggregate-${props.runId}.pdf` },
    };
  }
  const base = `/api/account/sonar/audit/reports/${props.runId}/vendor/${props.vendorId}`;
  return {
    json: {
      href: `${base}?format=json`,
      download: `per-vendor-${props.runId}-${props.vendorId}.json`,
    },
    csv: {
      href: `${base}?format=csv`,
      download: `per-vendor-${props.runId}-${props.vendorId}.csv`,
    },
    pdf: {
      href: `${base}?format=pdf`,
      download: `per-vendor-${props.runId}-${props.vendorId}.pdf`,
    },
  };
}

const FORMATS: readonly Format[] = ['json', 'csv', 'pdf'];

export function DownloadMenu(props: Props) {
  const [open, setOpen] = useState(false);
  // Loading indicator covers all formats (spec §5.7: added "for consistency
  // with JSON / CSV downloads"). The browser's anchor download is opaque so
  // the indicator is timer-based — auto-clears after 4s as a safety net.
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
