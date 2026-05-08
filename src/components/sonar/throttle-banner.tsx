/**
 * ThrottleBanner — server-renderable informational banner displayed on run
 * detail pages when a run has been throttled due to budget exhaustion.
 *
 * v1.29 Phase 1.
 */
export function ThrottleBanner() {
  return (
    <div className="rounded-md bg-amber-50 border border-amber-200 p-4 mb-4">
      <p className="text-sm text-amber-900">
        This run reached your hourly observation budget. It will continue
        automatically when budget refreshes.
      </p>
    </div>
  );
}
