"use client";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen bg-light-gray flex items-center justify-center">
      <div className="text-center max-w-md">
        <p className="text-6xl font-bold text-problem mb-4">Error</p>
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold text-navy mb-2">
          Something went wrong
        </h1>
        <p className="text-slate mb-2">
          An unexpected error occurred. Please try again.
        </p>
        {error.digest && (
          <p className="text-xs text-light-slate mb-6">
            Error ID: {error.digest}
          </p>
        )}
        <button
          onClick={reset}
          className="inline-flex items-center px-4 py-2.5 bg-navy text-white text-sm font-medium rounded-lg hover:bg-charcoal transition-colors"
        >
          Try Again
        </button>
      </div>
    </div>
  );
}
