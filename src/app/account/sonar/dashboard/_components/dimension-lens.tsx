'use client';

import { useState, type ReactNode } from 'react';
import { SectionTabs } from '@/components/sonar/section-tabs';
import { DIMENSIONS, DIMENSION_LABEL, type Dimension } from '@/app/account/sonar/_lib/origin-dimension';
import { GeoChart } from '../_charts/geo-chart';
import { PartnersChart } from '../_charts/partners-chart';
import type { AuditChartData } from '../_lib/load-audit-charts';

const GEO_TITLE: Record<Dimension, string> = {
  manufacturing: 'Components by country',
  design: 'Components by design country',
  firmware: 'Components by firmware country',
};

function isDimension(id: string): id is Dimension {
  return (DIMENSIONS as readonly string[]).includes(id);
}

/**
 * D-219 (2026-09-08): one origin-dimension lens shared by the geo chart and the Coverage-by-Partner
 * chart (spec R4); client state only, default Manufacturing (R5). The risk pill does not take the
 * lens (R4).
 *
 * Ruling HW2 (2026-09-08): each tab's own `content` is that dimension's charts, non-null only when
 * it is the active tab, so the visible charts sit inside the active `role="tabpanel"` — a screen
 * reader landing on a panel gets content programmatically associated with it (WCAG 2.1 AA), not an
 * empty panel plus charts rendered as a sibling below the tablist.
 */
export function DimensionLens({ charts, classChart }: { charts: AuditChartData; classChart: ReactNode }) {
  const [dimension, setDimension] = useState<Dimension>('manufacturing');
  const hasRun = charts.latestRunId !== null;
  const footnote = charts.auditorCountry ? `* Components outside ${charts.auditorCountry}` : undefined;
  // A run with an unknown auditor country is a fixable state, named as such; no run at all keeps today's copy.
  const emptyMessage = hasRun && !charts.auditorCountry ? 'Set your company country to see partner compliance.' : undefined;

  const tabs = DIMENSIONS.map((d) => ({
    id: d,
    label: DIMENSION_LABEL[d],
    content:
      d === dimension ? (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <GeoChart data={charts.rollupByDimension[d]} title={GEO_TITLE[d]} />
            {classChart}
          </div>
          <PartnersChart data={charts.partnerComplianceByDimension[d]} footnote={footnote} emptyMessage={emptyMessage} />
        </>
      ) : null,
  }));

  return (
    <SectionTabs
      tabs={tabs}
      ariaLabel="Origin dimension"
      testId="dimension-lens"
      onChange={(id) => { if (isDimension(id)) setDimension(id); }}
    />
  );
}
