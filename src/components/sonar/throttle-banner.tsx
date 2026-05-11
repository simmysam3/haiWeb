import Link from 'next/link';

/**
 * ThrottleBanner — server-renderable informational banner displayed on run
 * detail pages when a run has been throttled due to budget exhaustion.
 *
 * v1.29 Phase 1 introduced the banner; v1.30 PR-6 Phase 8 added the help link.
 */
export function ThrottleBanner() {
  return (
    <div className="rounded-md bg-amber-50 border border-amber-200 p-4 mb-4">
      <p className="text-sm text-amber-900">
        This run reached your hourly observation budget. It will continue
        automatically when budget refreshes.
        <Link
          href="/help/throttling"
          className="text-teal hover:underline ml-2 text-sm"
        >
          Why am I throttled?
        </Link>
      </p>
    </div>
  );
}
