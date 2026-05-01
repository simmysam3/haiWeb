import { cookies } from 'next/headers';
import { headers } from 'next/headers';
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
  const cookieHeader = (await cookies()).toString();
  const reqHeaders = await headers();
  const host = reqHeaders.get('host') ?? 'localhost:3001';
  const proto = reqHeaders.get('x-forwarded-proto') ?? 'http';
  const baseUrl = `${proto}://${host}`;

  let initial: DashboardPayload = EMPTY_PAYLOAD;
  try {
    const res = await fetch(`${baseUrl}/api/account/provenance-keys/dashboard`, {
      headers: { cookie: cookieHeader },
      cache: 'no-store',
    });
    if (res.ok) {
      initial = await res.json();
    }
  } catch {
    // Fallback to empty payload; the dashboard handles empty state gracefully.
  }

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
