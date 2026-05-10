import { AuditPostureCard } from './audit-posture-card';
import { PhantomDemandCard } from './phantom-demand-card';
import { WatcherSignalsCard } from './watcher-signals-card';

interface Partner {
  partner_id: string;
  audit: { compliant: number; partial: number; non_compliant: number; total: number } | null;
  phantom_demand: { response_rate: number; window_id: string } | null;
  watcher: { capacity_band: 'low' | 'moderate' | 'high' | 'at_capacity' | null; lead_time_p90_days: number | null } | null;
}

interface Props {
  partners: Partner[];
}

export function ModalityLens({ partners }: Props) {
  let totalCompliant = 0;
  let totalNonCompliant = 0;
  let totalPartial = 0;
  const pdRates: number[] = [];
  const bandCounts = { low: 0, moderate: 0, high: 0, at_capacity: 0 } as Record<'low' | 'moderate' | 'high' | 'at_capacity', number>;
  const leadTimes: number[] = [];
  let pdPartnerCount = 0;

  for (const p of partners) {
    if (p.audit) {
      totalCompliant += p.audit.compliant;
      totalNonCompliant += p.audit.non_compliant;
      totalPartial += p.audit.partial;
    }
    if (p.phantom_demand) {
      pdRates.push(p.phantom_demand.response_rate);
      pdPartnerCount += 1;
    }
    if (p.watcher?.capacity_band) {
      bandCounts[p.watcher.capacity_band] += 1;
    }
    if (p.watcher?.lead_time_p90_days != null) {
      leadTimes.push(p.watcher.lead_time_p90_days);
    }
  }

  const averageResponseRate = pdRates.length > 0 ? pdRates.reduce((a, b) => a + b, 0) / pdRates.length : null;
  const medianLeadTimeP90 = leadTimes.length > 0
    ? leadTimes.sort((a, b) => a - b)[Math.floor(leadTimes.length / 2)]
    : null;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <AuditPostureCard totalCompliant={totalCompliant} totalNonCompliant={totalNonCompliant} totalPartial={totalPartial} />
      <PhantomDemandCard averageResponseRate={averageResponseRate} partnerCount={pdPartnerCount} />
      <WatcherSignalsCard capacityBandCounts={bandCounts} medianLeadTimeP90={medianLeadTimeP90} />
    </div>
  );
}
