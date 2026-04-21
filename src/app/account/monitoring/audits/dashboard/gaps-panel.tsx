// Placeholder stub — full implementation lands in Task 22.
export function GapsPanel({
  totalGaps,
  latestAt,
}: {
  totalGaps: number | null;
  latestAt: string | null;
}) {
  return (
    <div className="p-4 rounded border border-slate/10">
      Gaps: {totalGaps ?? 0} (as of {latestAt ?? 'never'})
    </div>
  );
}
