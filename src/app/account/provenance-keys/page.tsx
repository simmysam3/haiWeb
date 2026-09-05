import { fetchBffJson } from '@/lib/server-fetch';
import { PageHeader } from '@/components/page-header';
import { PageIntro } from '@/components/page-intro';
import { ProvenanceKeysDashboard, type DashboardPayload } from './provenance-keys-dashboard';

const EMPTY_PAYLOAD: DashboardPayload = {
  generated: [],
  installations: [],
  sharingPolicy: { shared_fields: [] },
  aggregateCounts: {
    generatorActiveCompliant: 0,
    generatorActiveGracePending: 0,
    generatorActiveNonCompliant: 0,
    installerGracePending: 0,
    installerNonCompliant: 0,
  },
};

export default async function ProvenanceKeysPage() {
  // D-62: origin from the configured PORTAL_BASE_URL, never the request's
  // Host header. On any failure fall back to the empty payload; the
  // dashboard handles the empty state gracefully.
  const result = await fetchBffJson<DashboardPayload>('/api/account/provenance-keys/dashboard');
  const initial: DashboardPayload = result.kind === 'ok' ? result.data : EMPTY_PAYLOAD;

  return (
    <div>
      <PageHeader
        title="Provenance Keys"
        description="Issue keys to verify provenance from your suppliers, and install keys issued by buyers."
      />
      <PageIntro>
        Provenance keys are the cryptographic credentials that verify a buyer&apos;s request is authentic before your agent discloses sensitive supply-chain detail. Issue keys to trusted suppliers (so they accept your phantom-demand and audit traffic), install keys your buyers have issued to you, and review the audit trail for each one.
      </PageIntro>
      <ProvenanceKeysDashboard initial={initial} />
    </div>
  );
}
