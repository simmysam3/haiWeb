export function MesUnavailable() {
  return (
    <span
      className="ml-2 inline-flex items-center rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600"
      title="Live MES capacity unavailable for this component. Showing standard + historical lead time only."
    >
      MES unavailable
    </span>
  );
}
