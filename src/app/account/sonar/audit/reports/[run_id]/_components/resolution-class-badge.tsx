import type { ResolutionClass } from '@/lib/haiwave-api';

const STYLES: Record<ResolutionClass, { label: string; cls: string }> = {
  agentic_eligible: { label: 'Agentic eligible', cls: 'bg-teal/10 text-teal' },
  out_of_band:      { label: 'Out of band',      cls: 'bg-orange/10 text-orange' },
  pending:          { label: 'Pending',          cls: 'bg-slate/10 text-slate' },
};

export function ResolutionClassBadge({ resolution_class }: { resolution_class: ResolutionClass }) {
  const { label, cls } = STYLES[resolution_class];
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${cls}`}>
      {label}
    </span>
  );
}
