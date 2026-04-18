'use client';

import type { ProvenanceKeyInstallation, SharingPolicy } from '@haiwave/protocol';

export interface InstallationsTableProps {
  installations: ProvenanceKeyInstallation[];
  sharingPolicy: SharingPolicy;
  onRefresh: () => void;
}

export function InstallationsTable({ installations }: InstallationsTableProps) {
  if (installations.length === 0) {
    return <p className="text-slate text-sm">No installations yet.</p>;
  }
  return <p className="text-slate text-sm">Installer table — implemented in Task 27.</p>;
}
