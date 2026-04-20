import type { InstallationCompliance } from '@haiwave/protocol';

export interface ComplianceChipProps {
  compliance: InstallationCompliance;
}

const BASE_CLASSES = 'inline-block rounded-full px-3 py-1 text-xs font-medium text-white';

export function ComplianceChip({ compliance }: ComplianceChipProps) {
  if (compliance.status === 'compliant') {
    return <span className={`${BASE_CLASSES} bg-teal`}>Compliant</span>;
  }

  const deadline = compliance.grace_deadline ? new Date(compliance.grace_deadline) : null;
  const daysDelta = deadline
    ? Math.ceil((deadline.getTime() - Date.now()) / 86_400_000)
    : 0;

  if (compliance.status === 'grace_pending') {
    return (
      <span className={`${BASE_CLASSES} bg-orange`}>
        Grace {Math.max(0, daysDelta)}d
      </span>
    );
  }

  return (
    <span className={`${BASE_CLASSES} bg-[#B3261E]`}>
      Non-compliant {Math.abs(daysDelta)}d overdue
    </span>
  );
}
