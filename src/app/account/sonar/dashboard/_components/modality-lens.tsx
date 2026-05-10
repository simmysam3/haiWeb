'use client';

import useSWR from 'swr';
import { jsonFetcher } from '@/lib/swr-fetcher';
import type { PhantomDemandAggregate } from '@haiwave/protocol';
import { AuditPostureCard } from './audit-posture-card';
import { PhantomDemandCard } from './phantom-demand-card';
import { WatcherSignalsCard } from './watcher-signals-card';

interface Partner {
  partner_id: string;
  audit: { compliant: number; partial: number; non_compliant: number; total: number } | null;
  watcher: { capacity_band: 'low' | 'moderate' | 'high' | 'at_capacity' | null; lead_time_p90_days: number | null } | null;
}

interface Props {
  partners: Partner[];
}

export function ModalityLens({ partners }: Props) {
  // Audit + Watcher: still derived from the cross-modality partners prop.
  let totalCompliant = 0;
  let totalNonCompliant = 0;
  let totalPartial = 0;
  const bandCounts = { low: 0, moderate: 0, high: 0, at_capacity: 0 } as Record<'low' | 'moderate' | 'high' | 'at_capacity', number>;
  const leadTimes: number[] = [];

  for (const p of partners) {
    if (p.audit) {
      totalCompliant += p.audit.compliant;
      totalNonCompliant += p.audit.non_compliant;
      totalPartial += p.audit.partial;
    }
    if (p.watcher?.capacity_band) {
      bandCounts[p.watcher.capacity_band] += 1;
    }
    if (p.watcher?.lead_time_p90_days != null) {
      leadTimes.push(p.watcher.lead_time_p90_days);
    }
  }

  const medianLeadTimeP90 = leadTimes.length > 0
    ? [...leadTimes].sort((a, b) => a - b)[Math.floor(leadTimes.length / 2)]
    : null;

  // Phantom Demand: v1.30 §7.7 — sourced from the new aggregate BFF route,
  // not from the cross-modality partners table.
  const { data: pdAggregate } = useSWR<PhantomDemandAggregate>(
    '/api/account/sonar/dashboard/phantom-demand-aggregate?window=7d',
    jsonFetcher,
  );

  const pdRows = pdAggregate?.rows ?? [];
  const pdPartnerCount = pdRows.length;
  const averageResponseRate =
    pdPartnerCount > 0
      ? pdRows.reduce((sum, r) => sum + r.response_rate, 0) / pdPartnerCount
      : null;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <AuditPostureCard totalCompliant={totalCompliant} totalNonCompliant={totalNonCompliant} totalPartial={totalPartial} />
      <PhantomDemandCard averageResponseRate={averageResponseRate} partnerCount={pdPartnerCount} />
      <WatcherSignalsCard capacityBandCounts={bandCounts} medianLeadTimeP90={medianLeadTimeP90} />
    </div>
  );
}
