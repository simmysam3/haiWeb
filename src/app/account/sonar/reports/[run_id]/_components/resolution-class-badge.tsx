import type { ResolutionClass } from '@/lib/haiwave-api';
import { Pill } from '@/components/pill';

const LABELS: Record<ResolutionClass, string> = {
  agentic_eligible: 'Agentic eligible',
  out_of_band: 'Out of band',
  pending: 'Pending',
};

export function ResolutionClassBadge({ resolution_class }: { resolution_class: ResolutionClass }) {
  return (
    <Pill category="resolution_class" value={resolution_class}>
      {LABELS[resolution_class]}
    </Pill>
  );
}
