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
 * chart (spec R4); client state only, default Manufacturing (R5). The tab control is SectionTabs with
 * empty panels — the charts below are the lens's subject and render once, so the class chart beside
 * the geo chart is not duplicated per panel. The risk pill does not take the lens (R4).
 */
export function DimensionLens({ charts, classChart }: { charts: AuditChartData; classChart: ReactNode }) {
  const [dimension, setDimension] = useState<Dimension>('manufacturing');
  const tabs = DIMENSIONS.map((d) => ({ id: d, label: DIMENSION_LABEL[d], content: null }));
  const hasRun = charts.latestRunId !== null;
  const footnote = charts.auditorCountry ? `* Components outside ${charts.auditorCountry}` : undefined;
  // A run with an unknown auditor country is a fixable state, named as such; no run at all keeps today's copy.
  const emptyMessage = hasRun && !charts.auditorCountry ? 'Set your company country to see partner compliance.' : undefined;

  return (
    <>
      <SectionTabs
        tabs={tabs}
        ariaLabel="Origin dimension"
        testId="dimension-lens"
        onChange={(id) => { if (isDimension(id)) setDimension(id); }}
      />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <GeoChart data={charts.rollupByDimension[dimension]} title={GEO_TITLE[dimension]} />
        {classChart}
      </div>
      <PartnersChart data={charts.partnerComplianceByDimension[dimension]} footnote={footnote} emptyMessage={emptyMessage} />
    </>
  );
}
