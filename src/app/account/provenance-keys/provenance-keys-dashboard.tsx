'use client';

import { useCallback, useState } from 'react';
import { Tabs } from '@/components/tabs';
import { GeneratedKeysTable } from './generator/generated-keys-table';
import { InstallationsTable } from './installer/installations-table';
import { ComplianceBanner } from './installer/compliance-banner';
import type {
  ProvenanceKeyWithCounts,
  ProvenanceKeyInstallation,
  SharingPolicy,
} from '@haiwave/protocol';

export interface DashboardPayload {
  generated: ProvenanceKeyWithCounts[];
  installations: ProvenanceKeyInstallation[];
  sharingPolicy: SharingPolicy;
  aggregateCounts: {
    generatorActiveCompliant: number;
    generatorActiveGracePending: number;
    generatorActiveNonCompliant: number;
    installerGracePending: number;
    installerNonCompliant: number;
  };
}

export function ProvenanceKeysDashboard({ initial }: { initial: DashboardPayload }) {
  const [state, setState] = useState<DashboardPayload>(initial);
  const [tab, setTab] = useState<'generator' | 'installer'>('generator');

  const refresh = useCallback(async () => {
    const res = await fetch('/api/account/provenance-keys/dashboard');
    if (res.ok) {
      setState(await res.json());
    }
  }, []);

  const TABS = [
    { key: 'generator', label: 'Generator', count: state.generated.length },
    { key: 'installer', label: 'Installer', count: state.installations.length },
  ];

  return (
    <div className="space-y-6">
      <Tabs tabs={TABS} active={tab} onChange={(k) => setTab(k as 'generator' | 'installer')} />

      {tab === 'generator' ? (
        <GeneratedKeysTable keys={state.generated} onRefresh={refresh} />
      ) : (
        <>
          <ComplianceBanner
            counts={state.aggregateCounts}
            installations={state.installations}
          />
          <InstallationsTable
            installations={state.installations}
            sharingPolicy={state.sharingPolicy}
            onRefresh={refresh}
          />
        </>
      )}
    </div>
  );
}
