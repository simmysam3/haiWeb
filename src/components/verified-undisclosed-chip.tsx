import { Pill } from '@/components/pill';

// Redaction chip for BOM nodes whose vendor identity is withheld (PD drill-in
// redaction redesign, spec 2026-07-23). Renders the run-scoped alias
// ("Supplier A") when one is assigned, otherwise the generic "Identity
// withheld". Always routes through <Pill category="disclosure"
// value="undisclosed_verified"> so the identity-withheld tooltip travels with
// every use and the every-badge-is-a-Pill rule holds.
export function VerifiedUndisclosedChip({
  alias,
  className,
}: {
  alias?: string | null;
  className?: string;
}) {
  return (
    <Pill
      category="disclosure"
      value="undisclosed_verified"
      tone="neutral"
      className={`border border-dashed border-slate/60 ${className ?? ''}`}
    >
      <span aria-hidden className="mr-1 font-semibold text-teal-dark">
        ✓
      </span>
      {alias ? `Supplier ${alias}` : 'Identity withheld'}
    </Pill>
  );
}
