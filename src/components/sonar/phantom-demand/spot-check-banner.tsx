interface SpotCheckBannerProps {
  /** ISO timestamp of when the snapshot was taken. */
  capturedAt?: string | null;
}

export function SpotCheckBanner({ capturedAt }: SpotCheckBannerProps) {
  return (
    <div className="rounded-lg border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-900">
      <p>
        <strong>Best-effort spot check.</strong> Lead times and inventory reflect a
        snapshot{capturedAt ? <> taken at <time dateTime={capturedAt}>{new Date(capturedAt).toLocaleString()}</time></> : null}.
        Submit a quote request to commit.
      </p>
    </div>
  );
}
