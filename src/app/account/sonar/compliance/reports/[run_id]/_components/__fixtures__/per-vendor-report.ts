import type { PerVendorReport } from '@/lib/haiwave-api';
import { FIXTURE_RUN_ID, FIXTURE_VENDOR_A_ID, FIXTURE_INITIATOR_ID } from './aggregate-report';

export { FIXTURE_RUN_ID, FIXTURE_VENDOR_A_ID, FIXTURE_INITIATOR_ID };

export function makePerVendorReport(overrides: Partial<PerVendorReport> = {}): PerVendorReport {
  return {
    report_type: 'per_vendor',
    header: {
      run_id: FIXTURE_RUN_ID,
      triggered_at: '2026-04-28T10:00:00.000Z',
      completed_at: '2026-04-28T10:05:00.000Z',
      scope_label: 'Acme key',
      scope_type: 'key',
      provenance_key_id: '11111111-1111-1111-1111-111111111111',
      initiator_participant_id: FIXTURE_INITIATOR_ID,
      initiator_legal_name: 'Acme Corp',
      vendor_participant_id: FIXTURE_VENDOR_A_ID,
      vendor_legal_name: 'Vendor A',
    },
    coverage_summary: {
      total_skus: 3,
      compliant_count: 2,
      partially_compliant_count: 0,
      non_compliant_count: 1,
    },
    sku_table: [
      {
        product_id: 'p1',
        sku_label: 'GASKET-2',
        resolution_status: 'compliant',
        current_origin_manifest_version: 4,
        unresolved_subtier_gap_count: 0,
        predominant_resolution_class: null,
        transformation_chain: null,
        lot_batch_lineage: null,
      },
      {
        product_id: 'p2',
        sku_label: 'BEARING-7',
        resolution_status: 'non_compliant',
        current_origin_manifest_version: null,
        unresolved_subtier_gap_count: 2,
        predominant_resolution_class: 'agentic_eligible',
        transformation_chain: null,
        lot_batch_lineage: null,
      },
    ],
    gap_detail: [
      {
        product_id: 'p2',
        sku_label: 'BEARING-7',
        gap_kind: 'unauthorized',
        resolution_class: 'agentic_eligible',
        declared_country: null,
        depth_level: 2,
        actionable_suggestion: 'Counterparty has not granted access; request a manifest disclosure or key installation.',
      },
    ],
    footer: {
      generated_at: '2026-04-28T10:05:01.000Z',
      contact_email: 'audits@acme.com',
      disclaimer: 'For informational purposes only.',
    },
    temporal_validity_window: null,
    ...overrides,
  };
}
