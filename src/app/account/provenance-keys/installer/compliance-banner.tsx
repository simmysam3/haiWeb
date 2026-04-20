import type { ProvenanceKeyInstallation } from '@haiwave/protocol';

export interface ComplianceBannerProps {
  counts: {
    installerGracePending: number;
    installerNonCompliant: number;
  };
  installations: ProvenanceKeyInstallation[];
}

export function ComplianceBanner({ counts, installations }: ComplianceBannerProps) {
  const { installerGracePending, installerNonCompliant } = counts;
  if (installerGracePending === 0 && installerNonCompliant === 0) return null;

  const affected = installations.filter(
    (i) => i.compliance.status === 'grace_pending' || i.compliance.status === 'non_compliant',
  );

  const soonestDeadlineMs = affected
    .map((i) =>
      i.compliance.grace_deadline
        ? new Date(i.compliance.grace_deadline).getTime()
        : Infinity,
    )
    .reduce((a, b) => Math.min(a, b), Infinity);

  const daysRemaining = isFinite(soonestDeadlineMs)
    ? Math.max(0, Math.ceil((soonestDeadlineMs - Date.now()) / 86_400_000))
    : null;

  const isRed = installerNonCompliant > 0;
  const bg = isRed ? 'bg-[#B3261E]' : 'bg-orange';
  const totalNeedsAttention = installerGracePending + installerNonCompliant;

  return (
    <div
      role="status"
      className={`${bg} text-white rounded px-4 py-3 text-sm flex items-center justify-between`}
    >
      <div>
        <strong>
          {totalNeedsAttention} key{totalNeedsAttention === 1 ? '' : 's'} need your attention
        </strong>
        {daysRemaining !== null && !isRed && (
          <span className="ml-2">— {daysRemaining} days remaining on soonest</span>
        )}
        {isRed && <span className="ml-2">— some have passed grace deadline</span>}
      </div>
    </div>
  );
}
