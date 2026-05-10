interface PhantomDemandScopeSnapshot {
  kind: 'phantom_demand';
  counterparty: string;
  skus: string[];
  hypothetical_quantity: number;
  hypothetical_timeline: string | null;
}

export function ScopeSummary({ scope }: { scope: PhantomDemandScopeSnapshot }) {
  return (
    <section>
      <h2 className="text-sm font-medium text-charcoal mb-2">Scope</h2>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm max-w-md">
        <dt className="text-slate font-medium">Counterparty</dt>
        <dd className="text-charcoal font-mono truncate">{scope.counterparty}</dd>
        <dt className="text-slate font-medium">SKUs</dt>
        <dd className="text-charcoal">{scope.skus.length}</dd>
        <dt className="text-slate font-medium">Quantity</dt>
        <dd className="text-charcoal">{scope.hypothetical_quantity}</dd>
        <dt className="text-slate font-medium">Timeline</dt>
        <dd className="text-charcoal">
          {scope.hypothetical_timeline ?? 'as soon as possible'}
        </dd>
      </dl>
    </section>
  );
}
