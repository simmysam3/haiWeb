import type { ResolutionStatus } from '@/lib/haiwave-api';
import { Pill } from '@/components/pill';

const LABELS: Record<ResolutionStatus, string> = {
  compliant: 'Compliant',
  partially_compliant: 'Partially compliant',
  non_compliant: 'Non-compliant',
};

export function ResolutionStatusBadge({ resolution_status }: { resolution_status: ResolutionStatus }) {
  return (
    <Pill category="resolution_status" value={resolution_status}>
      {LABELS[resolution_status]}
    </Pill>
  );
}
