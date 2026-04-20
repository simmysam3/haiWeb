'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

/**
 * Shows a nudge banner when the user has no provenance key installations
 * that would unlock vendor-identity / sub-national detail for this vendor.
 *
 * Milestone A: the installation payload doesn't expose generator info, so
 * we can't reliably filter by vendor on the client. As a simple approximation
 * we show the banner when the installer has zero installations at all.
 * A future milestone can narrow the filter once installation responses
 * include the generator participant id (or the BFF supports ?vendor_id=).
 */
export function KeyNudgeBanner({ vendorId }: { vendorId: string }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/account/provenance-keys/installations?vendor_id=${encodeURIComponent(vendorId)}&active_only=true`,
        );
        if (!res.ok) return;
        const body = (await res.json()) as { installations?: unknown[] };
        if (cancelled) return;
        setShow(!body.installations || body.installations.length === 0);
      } catch {
        /* silent — banner just won't show */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [vendorId]);

  if (!show) return null;

  return (
    <div className="mb-4 rounded border border-orange/40 bg-orange/5 p-3 text-sm text-charcoal">
      You have no provenance key installed with this vendor. Audits will return country-of-origin and operational status only.{' '}
      <Link href="/account/provenance-keys" className="text-teal underline">
        Install a key
      </Link>{' '}
      for state, city, and vendor-identity detail.
    </div>
  );
}
