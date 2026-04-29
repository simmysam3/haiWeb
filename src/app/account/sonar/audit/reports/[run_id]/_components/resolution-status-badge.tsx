import type { ResolutionStatus } from '@/lib/haiwave-api';

const STYLES: Record<ResolutionStatus, { label: string; cls: string }> = {
  compliant:           { label: 'Compliant',           cls: 'bg-teal/10 text-teal' },
  partially_compliant: { label: 'Partially compliant', cls: 'bg-orange/10 text-orange' },
  non_compliant:       { label: 'Non-compliant',       cls: 'bg-problem/10 text-problem' },
};

export function ResolutionStatusBadge({ resolution_status }: { resolution_status: ResolutionStatus }) {
  const { label, cls } = STYLES[resolution_status];
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${cls}`}>
      {label}
    </span>
  );
}
