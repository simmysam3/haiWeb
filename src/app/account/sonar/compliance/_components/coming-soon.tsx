export function ComingSoon({ surface }: { surface: string }) {
  return (
    <div className="rounded-md border border-slate-200 bg-white p-8 text-center">
      <h1 className="text-2xl font-display text-navy">{surface}</h1>
      <p className="mt-2 text-sm text-slate">
        This compliance surface is being rolled out in v1.34. It will populate
        once compliance snapshots are available.
      </p>
    </div>
  );
}
