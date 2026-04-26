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
  results: AuditRunResult[],
): PartnerComplianceData {
  const vendorIdsInScope = new Set(
    latestRun.scope_snapshot.resolved_products.map((p) => p.vendor_id),
  );

  const byVendor = new Map<
    string,
    { vendor_legal_name: string | null; non_compliant_count: number }
  >();

  for (const r of results) {
    const nonCompliant = r.geo_rollup.reduce(
      (sum, e) => (e.country_of_origin === 'US' ? sum : sum + e.component_count),
      0,
    );
    const existing = byVendor.get(r.vendor_participant_id);
    if (existing) {
      existing.non_compliant_count += nonCompliant;
      if (existing.vendor_legal_name === null && r.tree.vendor_legal_name) {
        existing.vendor_legal_name = r.tree.vendor_legal_name;
      }
    } else {
      byVendor.set(r.vendor_participant_id, {
        vendor_legal_name: r.tree.vendor_legal_name ?? null,
        non_compliant_count: nonCompliant,
      });
    }
  }

  const rows: PartnerRow[] = [];
  let total_non_compliant = 0;
  for (const [vendor_participant_id, v] of byVendor) {
    total_non_compliant += v.non_compliant_count;
    if (v.non_compliant_count > 0) {
      rows.push({
        vendor_participant_id,
        vendor_legal_name: v.vendor_legal_name,
        non_compliant_count: v.non_compliant_count,
      });
    }
  }

  return {
    rows,
    total_vendors_in_scope: vendorIdsInScope.size,
    total_non_compliant,
    median_per_vendor: 0,
  };
}
