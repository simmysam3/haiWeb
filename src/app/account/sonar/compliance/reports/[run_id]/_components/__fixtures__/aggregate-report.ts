import type { AggregateReport } from '@/lib/haiwave-api';

export const FIXTURE_RUN_ID = '00000000-0000-0000-0000-000000000001';
export const FIXTURE_INITIATOR_ID = '22222222-2222-2222-2222-222222222222';
export const FIXTURE_VENDOR_A_ID = '33333333-3333-3333-3333-333333333333';
export const FIXTURE_VENDOR_B_ID = '44444444-4444-4444-4444-444444444444';

export function makeAggregateReport(overrides: Partial<AggregateReport> = {}): AggregateReport {
  return {
    report_type: 'aggregate',
    header: {
      run_id: FIXTURE_RUN_ID,
      triggered_at: '2026-04-28T10:00:00.000Z',
      completed_at: '2026-04-28T10:05:00.000Z',
      scope_label: 'Acme key',
      scope_type: 'key',
      provenance_key_id: '11111111-1111-1111-1111-111111111111',
      initiator_participant_id: FIXTURE_INITIATOR_ID,
      initiator_legal_name: 'Acme Corp',
    },
    posture_summary: {
      total_vendors: 2,
      compliant_count: 1,
      partially_compliant_count: 0,
      non_compliant_count: 1,
      total_products: 5,
      total_gaps: 3,
    },
    geographic_rollup: [
      { country_of_origin: 'US', country_label: 'United States', component_count: 4 },
      { country_of_origin: 'DE', country_label: 'Germany', component_count: 1 },
    ],
    class_rollup: [
      {
        node_id: 'c1c1c1c1-0000-0000-0000-000000000001',
        master_label: 'Gaskets',
        root_label: 'Industrial Components',
        component_count: 3,
        depth: 1,
      },
      {
        node_id: 'c2c2c2c2-0000-0000-0000-000000000002',
        master_label: 'Bearings',
        root_label: 'Industrial Components',
        component_count: 2,
        depth: 1,
      },
    ],
    gap_inventory: [
      {
        vendor_participant_id: FIXTURE_VENDOR_A_ID,
        vendor_legal_name: 'Vendor A',
        product_id: 'p1',
        gap_kind: 'unauthorized',
        resolution_class: 'agentic_eligible',
        declared_country: null,
        depth_level: 1,
        actionable_suggestion: 'Counterparty has not granted access; request a manifest disclosure.',
      },
      {
        vendor_participant_id: FIXTURE_VENDOR_B_ID,
        vendor_legal_name: 'Vendor B',
        product_id: 'p2',
        gap_kind: 'non_participant',
        resolution_class: 'out_of_band',
        declared_country: 'DE',
        depth_level: 2,
        actionable_suggestion: 'Counterparty is not a HAIWAVE participant; off-network outreach required.',
      },
    ],
    per_vendor_summary: [
      {
        vendor_participant_id: FIXTURE_VENDOR_A_ID,
        vendor_legal_name: 'Vendor A',
        resolution_status: 'compliant',
        product_count: 3,
        gap_count: 0,
        per_vendor_report_path: `/sonar/audit/reports/${FIXTURE_RUN_ID}/company/${FIXTURE_VENDOR_A_ID}`,
      },
      {
        vendor_participant_id: FIXTURE_VENDOR_B_ID,
        vendor_legal_name: 'Vendor B',
        resolution_status: 'non_compliant',
        product_count: 2,
        gap_count: 3,
        per_vendor_report_path: `/sonar/audit/reports/${FIXTURE_RUN_ID}/company/${FIXTURE_VENDOR_B_ID}`,
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
