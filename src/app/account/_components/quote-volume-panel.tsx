"use client";

import useSWR from "swr";
import { jsonFetcher } from "@/lib/swr-fetcher";
import { StatCard } from "@/components/stat-card";
import type { QuoteMetrics } from "@/lib/haiwave-api";

/** `undefined`/`null` → `null` so StatCard renders "Not Available" rather
 *  than a fabricated 0 — a zero would claim "no work waiting", which is a
 *  different and false statement before data has actually arrived. */
function val(v: number | undefined): string | null {
  return v == null ? null : String(v);
}

/**
 * Quote volume panel for the System Dashboard (v1.66).
 *
 * Client-side because "today" depends on the viewer's timezone, and
 * `participants` carries no timezone column — the Server Component parent
 * (`app/account/page.tsx`) has no way to resolve it. Mirrors the polling
 * pattern in `components/account-nav.tsx`: useSWR + jsonFetcher directly,
 * no intermediate hook.
 */
export function QuoteVolumePanel() {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const { data } = useSWR<QuoteMetrics>(
    `/api/account/quote-metrics?tz=${encodeURIComponent(tz)}`,
    jsonFetcher,
  );

  return (
    <div className="mb-8">
      <div className="grid grid-cols-4 gap-6 mb-6">
        <StatCard label="Incoming Today" value={val(data?.incoming?.day)} />
        <StatCard label="Incoming This Week" value={val(data?.incoming?.week)} />
        <StatCard label="Incoming This Month" value={val(data?.incoming?.month)} />
        <StatCard label="Responded Today" value={val(data?.responded_today)} />
      </div>

      {/* Outstanding + its aging breakdown. The three buckets sum to
          Outstanding exactly — a viewer can verify the panel against
          itself, which is the point of surfacing both. */}
      <div className="grid grid-cols-4 gap-6">
        {/* No color override: StatCard defaults to text-navy (#1A1F36 on
            white, ~16.2:1) — text-teal (#29B0C3, ~2.60:1) fails WCAG AA even
            at large-bold size. */}
        <StatCard label="Outstanding in Queue" value={val(data?.outstanding)} />
        <StatCard label="Under 2 Days" value={val(data?.aging?.under_2d)} />
        <StatCard label="2 – 5 Days" value={val(data?.aging?.d2_5)} />
        <StatCard label="5+ Days" value={val(data?.aging?.d5_plus)} />
      </div>
      <p className="mt-2 mb-6 text-xs text-slate">
        Under 2 Days + 2 – 5 Days + 5+ Days sums to Outstanding in Queue.
      </p>

      {/* Kept visually separate (narrower, muted, own caption): a trailing
          30-day count, not a point-in-time bucket — it does not belong in
          the sum above and must not be mistaken for a fourth bucket. */}
      <div className="max-w-xs">
        <StatCard label="Expired (30d)" value={val(data?.expired_30d)} color="text-slate" />
      </div>
      <p className="mt-2 text-xs text-slate">
        Trailing 30-day count — not included in the aging buckets above.
      </p>
    </div>
  );
}
