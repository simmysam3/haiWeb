import type { AuditRun, AuditRunResult } from '@haiwave/protocol';

export interface PartnerAuditWeight {
  vendor_id: string;
  vendor_name: string | null;
  non_compliant_count: number;
  total_component_count: number;
  weight: number;
}

export function buildPerPartnerAuditWeights(
  latestRun: AuditRun,
  results: AuditRunResult[],
): Map<string, PartnerAuditWeight> {
  const vendorIdsInScope = new Set(
    latestRun.scope_snapshot.resolved_products.map((p) => p.vendor_id),
  );

  const byVendor = new Map<string, { name: string | null; nc: number; total: number }>();

  for (const r of results) {
    // Null vendor_participant_id = sub-tier identity withheld by the
    // disclosure boundary (protocol 3.26.0). Such rows can't be attributed
    // to a partner and never appear in `vendorIdsInScope` (the scope is the
    // initiator's direct tier only), so skipping them costs nothing here.
    if (r.vendor_participant_id === null) continue;
    const cur = byVendor.get(r.vendor_participant_id) ?? {
      name: r.tree.vendor_legal_name ?? null,
      nc: 0,
      total: 0,
    };
    if (cur.name === null && r.tree.vendor_legal_name) {
      cur.name = r.tree.vendor_legal_name;
    }
    for (const e of r.geo_rollup) {
      cur.total += e.component_count;
      if (e.country_of_origin !== 'US') cur.nc += e.component_count;
    }
    byVendor.set(r.vendor_participant_id, cur);
  }

  const out = new Map<string, PartnerAuditWeight>();
  for (const vendorId of vendorIdsInScope) {
    const v = byVendor.get(vendorId);
    const total = v?.total ?? 0;
    const nc = v?.nc ?? 0;
    out.set(vendorId, {
      vendor_id: vendorId,
      vendor_name: v?.name ?? null,
      non_compliant_count: nc,
      total_component_count: total,
      weight: total === 0 ? 0 : nc / total,
    });
  }

  return out;
}
