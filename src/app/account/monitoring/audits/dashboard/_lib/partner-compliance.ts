import type { AuditRun, AuditRunResult } from '@haiwave/protocol';

export interface PartnerRow {
  vendor_participant_id: string;
  vendor_legal_name: string | null;
  non_compliant_count: number;
}

export interface PartnerComplianceData {
  rows: PartnerRow[];
  total_vendors_in_scope: number;
  total_non_compliant: number;
  median_per_vendor: number;
}

export function buildPartnerCompliance(
  latestRun: AuditRun,
  _results: AuditRunResult[],
): PartnerComplianceData {
  const vendorIdsInScope = new Set(
    latestRun.scope_snapshot.resolved_products.map((p) => p.vendor_id),
  );
  return {
    rows: [],
    total_vendors_in_scope: vendorIdsInScope.size,
    total_non_compliant: 0,
    median_per_vendor: 0,
  };
}
