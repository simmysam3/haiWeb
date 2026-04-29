import '@testing-library/jest-dom/vitest';
import { describe, it, expect } from 'vitest';
import type {
  AggregateReport,
  PerVendorReport,
  ClassRollupEntry,
  PostureSummary,
  CoverageSummary,
  GeographicRollupRow,
  GapInventoryEntry,
  PerVendorSummaryRow,
  SkuTableRow,
  GapDetailEntry,
  ReportFooter,
  ResolutionStatus,
} from '@/lib/haiwave-api';
import { createHaiwaveClient } from '@/lib/haiwave-api';

describe('HaiwaveClient report methods (smoke)', () => {
  it('exposes getAggregateReport, getPerVendorReport, fetchRaw on the client interface', () => {
    const client = createHaiwaveClient('header.payload.sig', 'p-self');
    expect(typeof client.getAggregateReport).toBe('function');
    expect(typeof client.getPerVendorReport).toBe('function');
    expect(typeof client.fetchRaw).toBe('function');
  });

  it('compiles when consuming the re-exported types', () => {
    const _aggregate: AggregateReport | null = null;
    const _perVendor: PerVendorReport | null = null;
    const _classRollup: ClassRollupEntry[] = [];
    const _posture: PostureSummary | null = null;
    const _coverage: CoverageSummary | null = null;
    const _geo: GeographicRollupRow[] = [];
    const _gapInv: GapInventoryEntry[] = [];
    const _perVendorRow: PerVendorSummaryRow[] = [];
    const _skuRow: SkuTableRow[] = [];
    const _gapDetail: GapDetailEntry[] = [];
    const _footer: ReportFooter | null = null;
    const _status: ResolutionStatus | null = null;
    expect([
      _aggregate, _perVendor, _classRollup, _posture, _coverage, _geo,
      _gapInv, _perVendorRow, _skuRow, _gapDetail, _footer, _status,
    ]).toHaveLength(12);
  });
});
