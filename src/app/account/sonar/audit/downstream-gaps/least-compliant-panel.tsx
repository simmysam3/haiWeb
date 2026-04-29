export function LeastCompliantPanel() {
  return (
    <aside className="rounded-lg border border-dashed border-slate/30 bg-light-gray/50 p-6">
      <h2 className="text-sm font-display uppercase tracking-wider text-slate">
        Least Compliant Vendors
      </h2>
      <p className="mt-3 text-sm text-slate">
        Subtier vendor identity is being added in a future release. Once
        available, this panel will rank your sub-tier suppliers by the gap
        count blocking your accepted obligations.
      </p>
    </aside>
  );
}
