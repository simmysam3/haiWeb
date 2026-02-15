import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-light-gray flex items-center justify-center">
      <div className="text-center">
        <p className="text-6xl font-bold text-navy mb-4">404</p>
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold text-navy mb-2">
          Page Not Found
        </h1>
        <p className="text-slate mb-8">
          The page you are looking for does not exist or has been moved.
        </p>
        <Link
          href="/"
          className="inline-flex items-center px-4 py-2.5 bg-navy text-white text-sm font-medium rounded-lg hover:bg-charcoal transition-colors"
        >
          Back to Home
        </Link>
      </div>
    </div>
  );
}
