import { redirect } from "next/navigation";

/**
 * The portal no longer shows a sign-in card. `/login` (and any lingering link to
 * it) bounces straight to the OIDC start route, which redirects to Keycloak.
 * A `?next=` is forwarded if present so deep links keep their destination.
 *
 * EXCEPTION: when the OIDC callback fails it redirects back here with `?error=`.
 * Re-entering the flow in that case loops (callback fails → /login?error= →
 * start → Keycloak → callback fails → …) until the browser gives up with
 * ERR_TOO_MANY_REDIRECTS, and the user never sees why. So when an `error` is
 * present we render an actionable, branded message with a MANUAL retry — the
 * deliberate click is what breaks the loop. The raw `error` value (user-
 * controllable query content) is never reflected into the page.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;
  if (error) {
    return (
      <div className="min-h-screen bg-light-gray flex items-center justify-center p-4">
        <div className="w-full max-w-md text-center">
          <div className="bg-white rounded-xl border border-slate/15 p-8">
            <h1 className="font-[family-name:var(--font-display)] text-xl font-bold text-navy">
              We couldn’t complete sign-in
            </h1>
            <p className="text-sm text-slate mt-2">
              Something went wrong while signing you in. Please try again.
            </p>
            <a
              href="/api/auth/login"
              className="mt-6 inline-block bg-navy text-white text-sm font-medium py-2.5 px-6 rounded-lg hover:bg-charcoal transition-colors"
            >
              Try again
            </a>
          </div>
        </div>
      </div>
    );
  }
  redirect(next ? `/api/auth/login?next=${encodeURIComponent(next)}` : "/api/auth/login");
}
