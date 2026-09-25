import Link from 'next/link';

/** Rendered with HTTP 403 when a server component calls forbidden(). */
export default function Forbidden() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-light-gray p-8">
      <div className="max-w-md rounded-xl border border-slate/15 bg-white p-8 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate">403</p>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-2xl font-bold text-navy">You don’t have access to this page</h1>
        <p className="mt-3 text-sm text-charcoal">Your role does not include this application. Ask your account owner for access.</p>
        <Link href="/account" className="mt-6 inline-block text-sm font-medium text-teal-dark hover:underline">
          Back to the console
        </Link>
      </div>
    </main>
  );
}
