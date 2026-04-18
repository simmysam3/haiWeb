import type { ProvenanceKeyInstallation } from '@haiwave/protocol';

export interface ComplianceBannerProps {
  counts: {
    installerGracePending: number;
    installerNonCompliant: number;
  };
  installations: ProvenanceKeyInstallation[];
}

export function ComplianceBanner({ counts }: ComplianceBannerProps) {
  if (counts.installerGracePending === 0 && counts.installerNonCompliant === 0) return null;
  return <p className="text-slate text-sm">Compliance banner — implemented in Task 27.</p>;
}
